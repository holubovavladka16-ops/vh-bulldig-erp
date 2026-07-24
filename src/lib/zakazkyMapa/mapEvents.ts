/** Událost po vytvoření/úpravě zakázky – modul mapy na ni reaguje obnovením dat. */
export const MAP_ORDERS_CHANGED_EVENT = 'zakazky-mapa:orders-changed'

export function notifyMapOrdersChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(MAP_ORDERS_CHANGED_EVENT))
}
