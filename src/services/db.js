import { openDB } from 'idb'

const DB_NAME = 'moneyman'
const DB_VERSION = 4

let dbInstance = null

export function resetDB() {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}

export async function initDB() {
  if (dbInstance) return dbInstance
  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      if (oldVersion < 1) {
        // Fresh install: create all stores with all indexes
        const txStore = db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true })
        txStore.createIndex('date', 'date')
        txStore.createIndex('category', 'category')
        txStore.createIndex('cardId', 'cardId')
        txStore.createIndex('subcategory', 'subcategory')
        txStore.createIndex('cwId', 'cwId')

        db.createObjectStore('cards', { keyPath: 'id' })

        const catStore = db.createObjectStore('categories', { keyPath: 'id', autoIncrement: true })
        catStore.createIndex('parentId', 'parentId')
        catStore.createIndex('type', 'type')

        db.createObjectStore('templates', { keyPath: 'id', autoIncrement: true })
        db.createObjectStore('cwmoney_meta', { keyPath: 'key' })
      }
      if (oldVersion >= 1 && oldVersion < 2) {
        // Upgrade from v1: add new indexes to existing stores
        const txStore = transaction.objectStore('transactions')
        if (!txStore.indexNames.contains('subcategory')) {
          txStore.createIndex('subcategory', 'subcategory')
        }

        const catStore = transaction.objectStore('categories')
        if (!catStore.indexNames.contains('parentId')) {
          catStore.createIndex('parentId', 'parentId')
        }
        if (!catStore.indexNames.contains('type')) {
          catStore.createIndex('type', 'type')
        }
      }
      if (oldVersion >= 1 && oldVersion < 3) {
        if (!db.objectStoreNames.contains('templates')) {
          db.createObjectStore('templates', { keyPath: 'id', autoIncrement: true })
        }
      }
      if (oldVersion >= 1 && oldVersion < 4) {
        if (!db.objectStoreNames.contains('cwmoney_meta')) {
          db.createObjectStore('cwmoney_meta', { keyPath: 'key' })
        }
        const txStore = transaction.objectStore('transactions')
        if (!txStore.indexNames.contains('cwId')) {
          txStore.createIndex('cwId', 'cwId')
        }
      }
    }
  })
  return dbInstance
}

export async function migrateData() {
  const db = await initDB()

  // Step A: Migrate categories — add type and parentId if missing
  const allCategories = await db.getAll('categories')
  const needsCategoryMigration = allCategories.some(cat => cat.type === undefined)
  if (needsCategoryMigration) {
    const catTx = db.transaction('categories', 'readwrite')
    const catStore = catTx.objectStore('categories')
    for (const cat of allCategories) {
      if (cat.type === undefined) {
        await catStore.put({ ...cat, type: 'expense', parentId: null })
      }
    }
    await catTx.done
  }

  // Step B: Build name→id map from parent categories (parentId is null)
  const updatedCategories = await db.getAll('categories')
  const nameToId = new Map()
  for (const cat of updatedCategories) {
    if (cat.parentId === null || cat.parentId === undefined) {
      nameToId.set(cat.name, cat.id)
    }
  }

  // Step C: Migrate transactions — convert string category to id
  const allTransactions = await db.getAll('transactions')
  const needsTransactionMigration = allTransactions.some(tx => typeof tx.category === 'string')
  if (needsTransactionMigration) {
    const txTx = db.transaction('transactions', 'readwrite')
    const txStore = txTx.objectStore('transactions')
    for (const record of allTransactions) {
      if (typeof record.category === 'string') {
        const categoryId = nameToId.get(record.category) ?? null
        await txStore.put({
          ...record,
          category: categoryId,
          subcategory: null,
          account: null
        })
      }
    }
    await txTx.done
  }
}

export async function addRecord(storeName, record) {
  const db = await initDB()
  return db.add(storeName, record)
}

export async function getRecords(storeName) {
  const db = await initDB()
  return db.getAll(storeName)
}

export async function getRecord(storeName, id) {
  const db = await initDB()
  return db.get(storeName, id)
}

export async function updateRecord(storeName, record) {
  const db = await initDB()
  return db.put(storeName, record)
}

export async function deleteRecord(storeName, id) {
  const db = await initDB()
  return db.delete(storeName, id)
}

export async function getRecordsByIndex(storeName, indexName, value) {
  const db = await initDB()
  return db.getAllFromIndex(storeName, indexName, value)
}

export async function clearStore(storeName) {
  const db = await initDB()
  const tx = db.transaction(storeName, 'readwrite')
  await tx.objectStore(storeName).clear()
  await tx.done
}

export async function bulkRestore(data) {
  const db = await initDB()
  const storeNames = ['transactions', 'cards', 'categories', 'templates', 'cwmoney_meta']
  const tx = db.transaction(storeNames, 'readwrite')
  await tx.objectStore('transactions').clear()
  await tx.objectStore('cards').clear()
  await tx.objectStore('categories').clear()
  await tx.objectStore('templates').clear()
  await tx.objectStore('cwmoney_meta').clear()
  for (const item of data.transactions || []) await tx.objectStore('transactions').put(item)
  for (const card of data.cards || []) await tx.objectStore('cards').put(card)
  for (const cat of data.categories || []) await tx.objectStore('categories').put(cat)
  for (const tpl of data.templates || []) await tx.objectStore('templates').put(tpl)
  for (const meta of data.cwmoney_meta || []) await tx.objectStore('cwmoney_meta').put(meta)
  await tx.done
}

export async function setCWMoneyMeta(key, value) {
  const db = await initDB()
  await db.put('cwmoney_meta', { key, value })
}

export async function getCWMoneyMeta(key) {
  const db = await initDB()
  const result = await db.get('cwmoney_meta', key)
  return result ? result.value : null
}
