import type { FotoOfflineZaznam, FotoSyncStatus, FotoUlozitVstup } from '@/types/fotodokumentace'

const DB_NAME = 'vh-fotodokumentace-offline'
const STORE = 'fronta'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'localId' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function ulozitDoOfflineFronty(
  payload: FotoUlozitVstup,
  createdBy: string
): Promise<string> {
  const db = await openDb()
  const localId = crypto.randomUUID()
  const zaznam: FotoOfflineZaznam = {
    localId,
    payload,
    createdBy,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(zaznam)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })

  db.close()
  return localId
}

export async function nacistOfflineFrontu(): Promise<FotoOfflineZaznam[]> {
  const db = await openDb()
  const items = await new Promise<FotoOfflineZaznam[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve((req.result ?? []) as FotoOfflineZaznam[])
    req.onerror = () => reject(req.error)
  })
  db.close()
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function aktualizovatOfflineStav(
  localId: string,
  status: FotoSyncStatus,
  errorMessage?: string
): Promise<void> {
  const db = await openDb()
  const existing = await new Promise<FotoOfflineZaznam | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(localId)
    req.onsuccess = () => resolve(req.result as FotoOfflineZaznam | undefined)
    req.onerror = () => reject(req.error)
  })

  if (!existing) {
    db.close()
    return
  }

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put({ ...existing, status, errorMessage })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function odstranitZOfflineFronty(localId: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(localId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}
