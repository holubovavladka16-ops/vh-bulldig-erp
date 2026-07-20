import type { FdgOfflineRecord, FdgSavePayload } from '@/types/fotodokumentaceGps'

const DB_NAME = 'vh-bulldig-fdg-offline'
const STORE = 'pending_photos'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error('Offline úložiště není dostupné.'))
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
  })
}

export async function saveOfflinePhoto(record: FdgOfflineRecord): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(record)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Offline uložení selhalo.'))
  })
  db.close()
}

export async function listOfflinePhotos(): Promise<FdgOfflineRecord[]> {
  const db = await openDb()
  const records = await new Promise<FdgOfflineRecord[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve((req.result ?? []) as FdgOfflineRecord[])
    req.onerror = () => reject(req.error ?? new Error('Offline načtení selhalo.'))
  })
  db.close()
  return records.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function removeOfflinePhoto(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Offline smazání selhalo.'))
  })
  db.close()
}

export function createOfflineRecord(
  file: File,
  payload: FdgSavePayload,
  thumbnailBlob: Blob | null
): FdgOfflineRecord {
  return {
    id: crypto.randomUUID(),
    payload,
    fileBlob: file,
    thumbnailBlob,
    createdAt: new Date().toISOString(),
    syncStatus: navigator.onLine ? 'pending' : 'offline',
  }
}
