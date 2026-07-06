import type { WorkerPriceItem, PriceUnitType, WorkType, TaskLineInput } from '@/types/workers'

export const HOURLY_RATE_NAME = 'Hodinová sazba'

export function isHourlyRateItem(item: Pick<WorkerPriceItem, 'name'>): boolean {
  return item.name === HOURLY_RATE_NAME
}

export function getHourlyRateItem(items: WorkerPriceItem[]): WorkerPriceItem | null {
  return items.find((i) => isHourlyRateItem(i) && i.is_active !== false) ?? null
}

/** Normalizace ceníku z DB (price může přijít jako string). */
export function normalizePriceItems(items: WorkerPriceItem[]): WorkerPriceItem[] {
  return items.map((item) => ({
    ...item,
    price: Number(item.price) || 0,
    is_active: item.is_active !== false,
  }))
}

/** Aktivní položky ceníku použitelné jako výkony (bez hodinové sazby). */
export function getTaskPriceItems(items: WorkerPriceItem[]): WorkerPriceItem[] {
  return items.filter((i) => i.is_active !== false && !isHourlyRateItem(i))
}

/** Řádky výkonů připravené k uložení – pouze platné položky s množstvím > 0. */
export function filterTaskLinesForSave(
  taskLines: TaskLineInput[],
  priceItems: WorkerPriceItem[]
): TaskLineInput[] {
  const taskItems = getTaskPriceItems(priceItems)
  return taskLines.filter((line) => {
    if (line.quantity <= 0) return false
    return taskItems.some((item) => item.id === line.price_item_id)
  })
}

export function hasValidPerformances(
  taskLines: TaskLineInput[],
  priceItems: WorkerPriceItem[]
): boolean {
  return filterTaskLinesForSave(taskLines, priceItems).length > 0
}

export function parseQuantityInput(raw: string): number {
  const normalized = raw.trim().replace(',', '.')
  if (!normalized) return 0
  const value = parseFloat(normalized)
  return Number.isFinite(value) && value >= 0 ? value : 0
}

/** Součet výdělku z výkonů (všechny aktivní položky ceníku) */
export function calculatePerformanceEarnings(
  taskLines: TaskLineInput[],
  priceItems: WorkerPriceItem[]
): number {
  let total = 0
  for (const line of taskLines) {
    if (line.quantity <= 0) continue
    const item = priceItems.find((p) => p.id === line.price_item_id)
    if (!item || item.is_active === false || isHourlyRateItem(item)) continue
    total += calculateTaskLineEarnings(item, line.quantity)
  }
  return total
}

export function calculateTaskLineEarnings(
  item: Pick<WorkerPriceItem, 'unit_type' | 'price'>,
  quantity: number
): number {
  switch (item.unit_type as PriceUnitType) {
    case 'metr':
    case 'm2':
    case 'den':
      return quantity * item.price
    case 'kus':
      return quantity * item.price
    case 'pausal':
      return quantity > 0 ? item.price * quantity : 0
    case 'hodina':
      return quantity * item.price
    default:
      return 0
  }
}

export function calculateFormEarnings(
  workType: WorkType,
  hourlyItem: WorkerPriceItem | null,
  hours: number,
  taskLines: TaskLineInput[],
  priceItems: WorkerPriceItem[]
): number {
  let total = 0

  if (workType === 'hodinova' || workType === 'kombinovana') {
    if (hourlyItem) {
      total += hours * hourlyItem.price
    }
  }

  if (workType === 'ukolova' || workType === 'kombinovana') {
    for (const line of taskLines) {
      if (line.quantity <= 0) continue
      const item = priceItems.find((p) => p.id === line.price_item_id)
      if (!item || item.name === HOURLY_RATE_NAME || item.is_active === false) continue
      total += calculateTaskLineEarnings(item, line.quantity)
    }
  }

  return total
}

export function getQuantityLabel(unitType: PriceUnitType): string {
  switch (unitType) {
    case 'metr':
      return 'bm'
    case 'm2':
      return 'm²'
    case 'den':
      return 'den'
    case 'kus':
      return 'ks'
    case 'pausal':
      return 'paušál'
    default:
      return 'množství'
  }
}

/** @deprecated Použijte calculateFormEarnings */
export function calculateEarnings(
  item: Pick<WorkerPriceItem, 'unit_type' | 'price'> | null,
  hours: number,
  meters: number,
  pieces: number
): number {
  if (!item) return 0
  return calculateTaskLineEarnings(item, item.unit_type === 'hodina' ? hours : item.unit_type === 'metr' ? meters : pieces)
}
