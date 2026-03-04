/**
 * CWMoney .iDB (SQLite) Export Service
 *
 * Exports MoneyMan data back to CWMoney .iDB format.
 * Two modes:
 *   - Edit-writeback: modify an existing .iDB (UPDATE/DELETE/INSERT)
 *   - Fresh export: create a new .iDB from scratch
 */

import { loadSqlJs, dateToTimestamp } from './cwmoney-parser.js'

/**
 * Reverse a category mapping: { cwKey: moneyManId } → { moneyManId: cwNumericId }
 */
function reverseCategoryMapping(mapping) {
  const parentReverse = {}
  const childReverse = {}

  for (const [cwKey, mmId] of Object.entries(mapping)) {
    if (typeof mmId !== 'number') continue
    const parts = cwKey.match(/^(expense|income)_(parent|child)_(\d+)$/)
    if (!parts) continue
    const cwId = parseInt(parts[3])
    if (parts[2] === 'parent') {
      parentReverse[mmId] = cwId
    } else {
      childReverse[mmId] = cwId
    }
  }

  return { parentReverse, childReverse }
}

/**
 * Reverse an account mapping: { cwAccId: name } → { name: cwAccId }
 */
function reverseAccountMapping(accountMapping) {
  const reverse = {}
  for (const [cwId, name] of Object.entries(accountMapping)) {
    reverse[name] = parseInt(cwId)
  }
  return reverse
}

/**
 * Compute a summary of changes between original .iDB and current MoneyMan transactions.
 */
export async function computeChangeSummary(originalIdb, transactions, categoryMapping, accountMapping) {
  const SQL = await loadSqlJs()
  const db = new SQL.Database(new Uint8Array(originalIdb))

  // Validate SQLite integrity
  const integrityResult = db.exec('PRAGMA integrity_check')
  if (!integrityResult.length || integrityResult[0].values[0][0] !== 'ok') {
    db.close()
    throw new Error('原始 .iDB 檔案已損壞，無法匯出')
  }

  const countResult = db.exec('SELECT COUNT(*) FROM rec_table')
  const originalCount = countResult.length ? countResult[0].values[0][0] : 0

  const existingIds = new Set()
  const idResult = db.exec('SELECT _id FROM rec_table')
  if (idResult.length) {
    for (const row of idResult[0].values) {
      existingIds.add(row[0])
    }
  }

  db.close()

  const mmCwIds = new Set()
  let inserted = 0
  for (const tx of transactions) {
    if (tx.cwId != null) {
      mmCwIds.add(tx.cwId)
    } else {
      inserted++
    }
  }

  let updated = 0
  let deleted = 0
  for (const cwId of existingIds) {
    if (mmCwIds.has(cwId)) {
      updated++
    } else {
      deleted++
    }
  }

  return { updated, inserted, deleted, originalCount }
}

/**
 * Build an exported .iDB by modifying the original with MoneyMan changes.
 */
export async function buildExportDB(originalIdb, transactions, categoryMapping, accountMapping) {
  const SQL = await loadSqlJs()
  const db = new SQL.Database(new Uint8Array(originalIdb))

  // Validate SQLite integrity before modifying
  const integrityResult = db.exec('PRAGMA integrity_check')
  if (!integrityResult.length || integrityResult[0].values[0][0] !== 'ok') {
    db.close()
    throw new Error('原始 .iDB 檔案已損壞，無法匯出')
  }

  const { parentReverse, childReverse } = reverseCategoryMapping(categoryMapping)
  const accReverse = reverseAccountMapping(accountMapping)

  // Build set of cwIds present in MoneyMan
  const mmCwIds = new Set()
  for (const tx of transactions) {
    if (tx.cwId != null) mmCwIds.add(tx.cwId)
  }

  // Delete records not in MoneyMan
  const idResult = db.exec('SELECT _id FROM rec_table')
  if (idResult.length) {
    for (const row of idResult[0].values) {
      const cwId = row[0]
      if (!mmCwIds.has(cwId)) {
        db.run('DELETE FROM rec_table WHERE _id = ?', [cwId])
      }
    }
  }

  // Update existing / Insert new
  for (const tx of transactions) {
    const iDate = dateToTimestamp(tx.date)
    const iKind = parentReverse[tx.category] || 0
    const iKinds = childReverse[tx.subcategory] || 0
    const iAccount = accReverse[tx.account] || 0
    const iType = tx.type === 'income' ? '2' : '1'

    if (tx.cwId != null) {
      db.run(
        `UPDATE rec_table SET i_money = ?, i_date = ?, i_kind = ?, i_kinds = ?, i_account = ?, i_remark = ?, i_type = ? WHERE _id = ?`,
        [tx.amount, iDate, iKind, iKinds, iAccount, tx.note, iType, tx.cwId]
      )
    } else {
      db.run(
        `INSERT INTO rec_table (i_money, i_date, i_kind, i_kinds, i_account, i_remark, i_type) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [tx.amount, iDate, iKind, iKinds, iAccount, tx.note, iType]
      )
    }
  }

  const result = new Uint8Array(db.export())
  db.close()
  return result
}

/**
 * CWMoney table schemas for fresh export.
 */
const CWMONEY_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS rec_table (_id INTEGER PRIMARY KEY AUTOINCREMENT, i_money REAL, i_date INTEGER, i_kind INTEGER, i_kinds INTEGER, i_account INTEGER, i_remark TEXT, i_type TEXT)`,
  `CREATE TABLE IF NOT EXISTS kind_table (_id INTEGER PRIMARY KEY, kindtext TEXT, pic TEXT, sort INTEGER)`,
  `CREATE TABLE IF NOT EXISTS kinds_table (_id INTEGER PRIMARY KEY, kindid INTEGER, kindstext TEXT, pic TEXT, sort INTEGER)`,
  `CREATE TABLE IF NOT EXISTS in_kind_table (_id INTEGER PRIMARY KEY, kindtext TEXT, pic TEXT, sort INTEGER)`,
  `CREATE TABLE IF NOT EXISTS in_kinds_table (_id INTEGER PRIMARY KEY, kindid INTEGER, kindstext TEXT, pic TEXT, sort INTEGER)`,
  `CREATE TABLE IF NOT EXISTS acc_table (_id INTEGER PRIMARY KEY, acctext TEXT, accpic TEXT, accsort INTEGER)`
]

/**
 * Build a fresh CWMoney .iDB from MoneyMan data (no original .iDB).
 */
export async function buildFreshExportDB(transactions, categories) {
  const SQL = await loadSqlJs()
  const db = new SQL.Database()

  for (const stmt of CWMONEY_SCHEMA) {
    db.run(stmt)
  }

  // Collect category IDs referenced by transactions
  const usedCatIds = new Set()
  for (const tx of transactions) {
    if (tx.category != null) usedCatIds.add(tx.category)
    if (tx.subcategory != null) usedCatIds.add(tx.subcategory)
  }
  // Also include parents of used children
  for (const cat of categories) {
    if (usedCatIds.has(cat.id) && cat.parentId != null) {
      usedCatIds.add(cat.parentId)
    }
  }

  // Build category mappings: MoneyMan ID → CW ID
  const parentMap = {}
  const childMap = {}

  // Expense parents
  const expenseParents = categories.filter(c => c.type === 'expense' && c.parentId === null && usedCatIds.has(c.id))
  expenseParents.forEach((cat, i) => {
    const cwId = i + 1
    parentMap[cat.id] = cwId
    db.run('INSERT INTO kind_table VALUES (?, ?, ?, ?)', [cwId, cat.name, 'k1', i])
  })

  // Expense children
  const expenseChildren = categories.filter(c => c.type === 'expense' && c.parentId !== null && usedCatIds.has(c.id))
  expenseChildren.forEach((cat, i) => {
    const cwId = i + 1
    childMap[cat.id] = cwId
    const cwParentId = parentMap[cat.parentId] || 0
    db.run('INSERT INTO kinds_table VALUES (?, ?, ?, ?, ?)', [cwId, cwParentId, cat.name, 'k1', i])
  })

  // Income parents
  const incomeParents = categories.filter(c => c.type === 'income' && c.parentId === null && usedCatIds.has(c.id))
  incomeParents.forEach((cat, i) => {
    const cwId = i + 1
    parentMap[cat.id] = cwId
    db.run('INSERT INTO in_kind_table VALUES (?, ?, ?, ?)', [cwId, cat.name, 'i1', i])
  })

  // Income children
  const incomeChildren = categories.filter(c => c.type === 'income' && c.parentId !== null && usedCatIds.has(c.id))
  incomeChildren.forEach((cat, i) => {
    const cwId = i + 1
    childMap[cat.id] = cwId
    const cwParentId = parentMap[cat.parentId] || 0
    db.run('INSERT INTO in_kinds_table VALUES (?, ?, ?, ?, ?)', [cwId, cwParentId, cat.name, 'i1', i])
  })

  // Build account mapping from unique account names
  const accountNames = [...new Set(transactions.map(t => t.account).filter(Boolean))]
  const accMap = {}
  accountNames.forEach((name, i) => {
    const cwId = i + 1
    accMap[name] = cwId
    db.run('INSERT INTO acc_table VALUES (?, ?, ?, ?)', [cwId, name, 'm1', i])
  })

  // Insert transactions
  for (const tx of transactions) {
    const iDate = dateToTimestamp(tx.date)
    const iKind = parentMap[tx.category] || 0
    const iKinds = childMap[tx.subcategory] || 0
    const iAccount = accMap[tx.account] || 0
    const iType = tx.type === 'income' ? '2' : '1'

    db.run(
      'INSERT INTO rec_table (i_money, i_date, i_kind, i_kinds, i_account, i_remark, i_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [tx.amount, iDate, iKind, iKinds, iAccount, tx.note, iType]
    )
  }

  const freshResult = new Uint8Array(db.export())
  db.close()
  return freshResult
}
