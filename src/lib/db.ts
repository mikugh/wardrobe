// Minimal promise wrapper around IndexedDB. Photos are stored as Blobs, which
// IndexedDB handles natively, so the wardrobe can hold hundreds of items.

const DB_NAME = 'virtual-wardrobe'
const DB_VERSION = 2

export type StoreName = 'items' | 'outfits' | 'places'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('items')) db.createObjectStore('items', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('outfits')) db.createObjectStore('outfits', { keyPath: 'id' })
        // v2: wardrobes and bags. Items from v1 get a wardrobe when the app loads (see store.tsx).
        if (!db.objectStoreNames.contains('places')) db.createObjectStore('places', { keyPath: 'id' })
      }
      req.onsuccess = () => {
        // Let a newer version of the app (in another tab) upgrade the database.
        req.result.onversionchange = () => req.result.close()
        resolve(req.result)
      }
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

async function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void) {
  const db = await openDb()
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(store, mode)
    const req = fn(tx.objectStore(store))
    tx.oncomplete = () => resolve(req ? req.result : undefined)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  return ((await run<T[]>(store, 'readonly', (s) => s.getAll())) ?? []) as T[]
}

export async function put<T>(store: StoreName, value: T): Promise<void> {
  await run(store, 'readwrite', (s) => s.put(value))
}

export async function putMany<T>(store: StoreName, values: T[]): Promise<void> {
  await run(store, 'readwrite', (s) => {
    for (const v of values) s.put(v)
  })
}

export async function remove(store: StoreName, id: string): Promise<void> {
  await run(store, 'readwrite', (s) => s.delete(id))
}

export async function removeMany(store: StoreName, ids: string[]): Promise<void> {
  await run(store, 'readwrite', (s) => {
    for (const id of ids) s.delete(id)
  })
}

export async function clear(store: StoreName): Promise<void> {
  await run(store, 'readwrite', (s) => s.clear())
}
