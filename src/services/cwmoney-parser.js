/**
 * CWMoney .iDB (SQLite) Parser Service
 *
 * Parses CWMoney (記帳城市) exported .iDB files and extracts
 * transaction records, categories, accounts, and date ranges.
 *
 * The .iDB file is a SQLite 3 database. Key tables:
 * - rec_table: transaction records
 * - kind_table / kinds_table: expense categories (parent / child)
 * - in_kind_table / in_kinds_table: income categories (parent / child)
 * - acc_table: accounts
 */

/**
 * Convert a Unix timestamp (seconds) to 'YYYY-MM-DD' string in UTC.
 * @param {number} ts - Unix timestamp in seconds
 * @returns {string} Date string in 'YYYY-MM-DD' format
 */
export function timestampToDate(ts) {
  const d = new Date(ts * 1000)
  const year = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Convert a 'YYYY-MM-DD' date string to Unix timestamp (seconds) at UTC midnight.
 * @param {string} dateStr - Date string in 'YYYY-MM-DD' format
 * @returns {number} Unix timestamp in seconds
 */
function dateToTimestamp(dateStr) {
  return Math.floor(new Date(dateStr + 'T00:00:00Z').getTime() / 1000)
}

/**
 * Map a raw rec_table row to a MoneyMan record object.
 *
 * Uses explicit SELECT column order (see REC_COLUMNS):
 *   0: _id, 1: i_money, 2: i_date, 3: i_kind, 4: i_kinds,
 *   5: i_account, 6: i_remark, 7: i_type
 *
 * @param {Array} row - A row from rec_table query result
 * @param {Object} accounts - Map of account id to name
 * @returns {Object} MoneyMan record
 */
const REC_COLUMNS = '_id, i_money, i_date, i_kind, i_kinds, i_account, i_remark, i_type'

function mapRow(row, accounts) {
  return {
    cwId: parseInt(row[0]),
    amount: parseFloat(row[1]),
    type: String(row[7]) === '2' ? 'income' : 'expense',
    date: timestampToDate(row[2]),
    note: row[6] || '',
    account: accounts[parseInt(row[5])] || null,
    cwKind: parseInt(row[3]),
    cwKinds: parseInt(row[4]),
    channel: null,
    cardId: null
  }
}

/**
 * Query the date range and record count from rec_table.
 * @param {Object} db - sql.js Database instance
 * @returns {{ min: string|null, max: string|null, count: number }}
 */
export function parseDateRange(db) {
  const rangeResult = db.exec('SELECT MIN(i_date), MAX(i_date) FROM rec_table')
  const countResult = db.exec('SELECT COUNT(*) FROM rec_table')

  if (!rangeResult.length || !rangeResult[0].values.length || rangeResult[0].values[0][0] == null) {
    return { min: null, max: null, count: 0 }
  }

  const [minTs, maxTs] = rangeResult[0].values[0]
  const count = countResult.length ? countResult[0].values[0][0] : 0

  return {
    min: timestampToDate(minTs),
    max: timestampToDate(maxTs),
    count
  }
}

/**
 * Parse all categories from the database.
 * @param {Object} db - sql.js Database instance
 * @returns {{ expenseParents: Array, expenseChildren: Array, incomeParents: Array, incomeChildren: Array }}
 */
export function parseCategories(db) {
  const expenseParentsResult = db.exec('SELECT _id, kindtext, pic, sort FROM kind_table ORDER BY sort')
  const expenseChildrenResult = db.exec('SELECT _id, kindid, kindstext, pic, sort FROM kinds_table ORDER BY sort')
  const incomeParentsResult = db.exec('SELECT _id, kindtext, pic, sort FROM in_kind_table ORDER BY sort')
  const incomeChildrenResult = db.exec('SELECT _id, kindid, kindstext, pic, sort FROM in_kinds_table ORDER BY sort')

  const mapParent = (row) => ({
    cwId: row[0],
    name: row[1],
    pic: row[2],
    sort: row[3]
  })

  const mapChild = (row) => ({
    cwId: row[0],
    cwParentId: row[1],
    name: row[2],
    pic: row[3],
    sort: row[4]
  })

  return {
    expenseParents: expenseParentsResult.length ? expenseParentsResult[0].values.map(mapParent) : [],
    expenseChildren: expenseChildrenResult.length ? expenseChildrenResult[0].values.map(mapChild) : [],
    incomeParents: incomeParentsResult.length ? incomeParentsResult[0].values.map(mapParent) : [],
    incomeChildren: incomeChildrenResult.length ? incomeChildrenResult[0].values.map(mapChild) : []
  }
}

/**
 * Parse accounts from acc_table.
 * @param {Object} db - sql.js Database instance
 * @returns {Object} Map of account id to name
 */
export function parseAccounts(db) {
  const result = db.exec('SELECT _id, acctext, accpic FROM acc_table ORDER BY accsort')
  if (!result.length) return {}

  const accounts = {}
  for (const row of result[0].values) {
    accounts[row[0]] = row[1]
  }
  return accounts
}

/**
 * Parse transaction records within a date range.
 * @param {Object} db - sql.js Database instance
 * @param {string} startDate - Start date 'YYYY-MM-DD'
 * @param {string} endDate - End date 'YYYY-MM-DD'
 * @param {Object} accounts - Map of account id to name
 * @returns {Array} Array of MoneyMan record objects
 */
export function parseRecords(db, startDate, endDate, accounts) {
  const startTs = dateToTimestamp(startDate)
  const endTs = dateToTimestamp(endDate) + 86399 // end of day

  const result = db.exec(
    `SELECT ${REC_COLUMNS} FROM rec_table WHERE i_date >= ${startTs} AND i_date <= ${endTs} ORDER BY i_date ASC`
  )

  if (!result.length) return []
  return result[0].values.map(row => mapRow(row, accounts))
}

/**
 * Get the count of records within a date range.
 * @param {Object} db - sql.js Database instance
 * @param {string} startDate - Start date 'YYYY-MM-DD'
 * @param {string} endDate - End date 'YYYY-MM-DD'
 * @returns {number}
 */
export function getRecordCount(db, startDate, endDate) {
  const startTs = dateToTimestamp(startDate)
  const endTs = dateToTimestamp(endDate) + 86399

  const result = db.exec(
    `SELECT COUNT(*) FROM rec_table WHERE i_date >= ${startTs} AND i_date <= ${endTs}`
  )

  if (!result.length) return 0
  return result[0].values[0][0]
}

/**
 * Get preview records (first 10 and last 10) within a date range.
 * @param {Object} db - sql.js Database instance
 * @param {string} startDate - Start date 'YYYY-MM-DD'
 * @param {string} endDate - End date 'YYYY-MM-DD'
 * @param {Object} accounts - Map of account id to name
 * @returns {{ first10: Array, last10: Array }}
 */
export function getPreviewRecords(db, startDate, endDate, accounts) {
  const startTs = dateToTimestamp(startDate)
  const endTs = dateToTimestamp(endDate) + 86399

  const firstResult = db.exec(
    `SELECT ${REC_COLUMNS} FROM rec_table WHERE i_date >= ${startTs} AND i_date <= ${endTs} ORDER BY i_date ASC LIMIT 10`
  )
  const lastResult = db.exec(
    `SELECT ${REC_COLUMNS} FROM rec_table WHERE i_date >= ${startTs} AND i_date <= ${endTs} ORDER BY i_date DESC LIMIT 10`
  )

  const first10 = firstResult.length ? firstResult[0].values.map(row => mapRow(row, accounts)) : []
  const last10 = lastResult.length ? lastResult[0].values.map(row => mapRow(row, accounts)).reverse() : []

  return { first10, last10 }
}

/**
 * Dynamically load sql.js library.
 * @returns {Promise<Object>} The initialized SQL.js module
 */
export async function loadSqlJs() {
  const initSqlJs = (await import('sql.js')).default
  return initSqlJs({
    locateFile: (file) => 'https://sql.js.org/dist/' + file
  })
}

/**
 * Open a CWMoney .iDB file as a sql.js Database.
 * @param {File} file - The .iDB file (File object from input)
 * @returns {Promise<Object>} sql.js Database instance
 */
export async function openIDB(file) {
  const SQL = await loadSqlJs()
  const buffer = await file.arrayBuffer()
  return new SQL.Database(new Uint8Array(buffer))
}
