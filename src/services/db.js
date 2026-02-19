import { openDB } from 'idb'

const DB_NAME = 'moneyman'
const DB_VERSION = 1

export async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('transactions')) {
        const txStore = db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true })
        txStore.createIndex('date', 'date')
        txStore.createIndex('category', 'category')
        txStore.createIndex('cardId', 'cardId')
      }
      if (!db.objectStoreNames.contains('cards')) {
        db.createObjectStore('cards', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: 'id', autoIncrement: true })
      }
    }
  })
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
