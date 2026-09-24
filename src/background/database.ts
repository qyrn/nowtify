import { normalizeHistoryEntry, type HistoryEntry } from '../shared/history'
import { normalizeStreamer, type Streamer } from '../shared/streamer'
import { HISTORY_LIMIT } from './config'

const DB_NAME = 'NowtifyDB'
const DB_VERSION = 2
const STREAMERS = 'streamers'
const HISTORY = 'history'

let connection: Promise<IDBDatabase> | null = null

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result)
    }
    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB request failed'))
    }
  })
}

function completion(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => {
      resolve()
    }
    transaction.onerror = () => {
      reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    }
    transaction.onabort = () => {
      reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
    }
  })
}

function upgrade(request: IDBOpenDBRequest, oldVersion: number): void {
  const db = request.result
  if (oldVersion < 1) {
    db.createObjectStore(STREAMERS, { keyPath: 'id' })
    db.createObjectStore(HISTORY, { keyPath: 'id', autoIncrement: true }).createIndex(
      'timestamp',
      'timestamp'
    )
  }
  if (oldVersion < 2) {
    request.transaction?.objectStore(HISTORY).createIndex('streamerId', 'streamerId')
  }
}

function open(): Promise<IDBDatabase> {
  connection ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = (event) => {
      upgrade(request, event.oldVersion)
    }
    request.onsuccess = () => {
      resolve(request.result)
    }
    request.onerror = () => {
      connection = null
      reject(request.error ?? new Error('Cannot open IndexedDB'))
    }
  })
  return connection
}

async function transaction(stores: string[], mode: IDBTransactionMode): Promise<IDBTransaction> {
  return (await open()).transaction(stores, mode)
}

export async function getAllStreamers(): Promise<Streamer[]> {
  const tx = await transaction([STREAMERS], 'readonly')
  const records = await promisify(tx.objectStore(STREAMERS).getAll())
  return records.map(normalizeStreamer).filter((streamer) => streamer !== null)
}

export async function putStreamers(streamers: Streamer[]): Promise<void> {
  const tx = await transaction([STREAMERS], 'readwrite')
  const store = tx.objectStore(STREAMERS)
  for (const streamer of streamers) store.put(streamer)
  await completion(tx)
}

export async function patchStreamers(patches: Map<string, Partial<Streamer>>): Promise<void> {
  const tx = await transaction([STREAMERS], 'readwrite')
  const store = tx.objectStore(STREAMERS)
  for (const [id, patch] of patches) {
    const request = store.get(id)
    request.onsuccess = () => {
      const current = normalizeStreamer(request.result)
      if (current) store.put({ ...current, ...patch })
    }
  }
  await completion(tx)
}

export async function deleteStreamers(ids: string[]): Promise<void> {
  const tx = await transaction([STREAMERS], 'readwrite')
  const store = tx.objectStore(STREAMERS)
  for (const id of ids) store.delete(id)
  await completion(tx)
}

export async function addHistoryEntry(entry: HistoryEntry): Promise<void> {
  const tx = await transaction([HISTORY], 'readwrite')
  const store = tx.objectStore(HISTORY)
  store.add(entry)
  const count = await promisify(store.count())
  if (count > HISTORY_LIMIT) {
    let excess = count - HISTORY_LIMIT
    const cursorRequest = store.index('timestamp').openCursor()
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result
      if (!cursor || excess <= 0) return
      cursor.delete()
      excess--
      cursor.continue()
    }
  }
  await completion(tx)
}

export async function closeHistoryEntry(streamerId: string, endedAt: number): Promise<void> {
  const tx = await transaction([HISTORY], 'readwrite')
  const cursorRequest = tx
    .objectStore(HISTORY)
    .index('streamerId')
    .openCursor(IDBKeyRange.only(streamerId), 'prev')
  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result
    if (!cursor) return
    const entry = normalizeHistoryEntry(cursor.value)
    if (entry && entry.endedAt === null) cursor.update({ ...(cursor.value as object), endedAt })
  }
  await completion(tx)
}

export async function getHistory(limit: number): Promise<HistoryEntry[]> {
  const tx = await transaction([HISTORY], 'readonly')
  const entries: HistoryEntry[] = []
  const cursorRequest = tx.objectStore(HISTORY).index('timestamp').openCursor(null, 'prev')
  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result
    if (!cursor || entries.length >= limit) return
    const entry = normalizeHistoryEntry(cursor.value)
    if (entry) entries.push(entry)
    cursor.continue()
  }
  await completion(tx)
  return entries
}

export async function importHistory(entries: HistoryEntry[]): Promise<number> {
  const existing = await getHistory(HISTORY_LIMIT)
  const known = new Set(existing.map((entry) => `${entry.streamerId}:${entry.timestamp}`))
  const fresh = entries.filter((entry) => !known.has(`${entry.streamerId}:${entry.timestamp}`))
  if (fresh.length === 0) return 0

  const tx = await transaction([HISTORY], 'readwrite')
  const store = tx.objectStore(HISTORY)
  for (const entry of fresh) store.add(entry)
  await completion(tx)
  return fresh.length
}

export async function clearHistory(): Promise<void> {
  const tx = await transaction([HISTORY], 'readwrite')
  tx.objectStore(HISTORY).clear()
  await completion(tx)
}
