/**
 * CWMoney .iDB (SQLite) Export Service
 *
 * Exports MoneyMan data back to CWMoney .iDB format.
 * Two modes:
 *   - Edit-writeback: modify an existing .iDB (UPDATE/DELETE/INSERT)
 *   - Fresh export: create a new .iDB from scratch
 */

import { loadSqlJs } from './cwmoney-parser.js'

/**
 * Convert 'YYYY-MM-DD' to Unix timestamp (seconds) at UTC midnight.
 */
function dateToTimestamp(dateStr) {
  return Math.floor(new Date(dateStr + 'T00:00:00Z').getTime() / 1000)
}

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
