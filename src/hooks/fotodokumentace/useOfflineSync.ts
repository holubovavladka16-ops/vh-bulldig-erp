import { useCallback, useEffect } from 'react'
import { ulozitFotodokument } from '@/lib/fotodokumentace/api'
import {
  aktualizovatOfflineStav,
  nacistOfflineFrontu,
  odstranitZOfflineFronty,
} from '@/lib/fotodokumentace/offlineQueue'
import { fetchJobOrders } from '@/lib/orders/api'

export function useOfflineSync(onSynced?: () => void) {
  const sync = useCallback(async () => {
    if (!navigator.onLine) return

    const fronta = await nacistOfflineFrontu()
    const pending = fronta.filter((z) => z.status === 'pending' || z.status === 'error')
    if (pending.length === 0) return

    const orders = await fetchJobOrders()
    const orderMap = new Map(orders.map((o) => [o.id, o.name]))

    for (const zaznam of pending) {
      try {
        await aktualizovatOfflineStav(zaznam.localId, 'uploading')
        const orderName = orderMap.get(zaznam.payload.order_id) ?? 'zakazka'
        await ulozitFotodokument(zaznam.payload, zaznam.createdBy, orderName)
        await odstranitZOfflineFronty(zaznam.localId)
      } catch (err) {
        await aktualizovatOfflineStav(
          zaznam.localId,
          'error',
          err instanceof Error ? err.message : 'Chyba synchronizace'
        )
      }
    }

    onSynced?.()
  }, [onSynced])

  useEffect(() => {
    void sync()
    window.addEventListener('online', sync)
    return () => window.removeEventListener('online', sync)
  }, [sync])

  return { syncNow: sync }
}
