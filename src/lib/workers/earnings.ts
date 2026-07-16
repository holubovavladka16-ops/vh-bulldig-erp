import type { WorkerPriceItem, PriceUnitType, WorkType, TaskLineInput } from '@/types/workers'

export const HOURLY_RATE_NAME = 'Hodinová práce'

export function isHourlyRateItem(item: Pick<WorkerPriceItem, 'name'>): boolean {
  return item.name === HOURLY_RATE_NAME || item.name === 'Hodinová sazba'
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

/**
 * Aktivní položky ceníku použitelné jako výkony – VČETNĚ hodinové práce.
 * Docházka (OD–DO) nikdy sama o sobě nevytváří výdělek; "Hodinová práce" je normální položka
 * ceníku jako kterákoli jiná – vybere se v roletce "Druh činnosti" a zadá se k ní konkrétní počet
 * hodin, přesně jako u výkopu, průrazu apod.
 */
export function getTaskPriceItems(items: WorkerPriceItem[]): WorkerPriceItem[] {
  return items.filter((i) => i.is_active !== false)
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

/** Součet výdělku z výkonů (všechny aktivní položky ceníku, včetně hodinové práce) */
export function calculatePerformanceEarnings(
  taskLines: TaskLineInput[],
  priceItems: WorkerPriceItem[]
): number {
  let total = 0
  for (const line of taskLines) {
    if (line.quantity <= 0) continue
    const item = priceItems.find((p) => p.id === line.price_item_id)
    if (!item || item.is_active === false) continue
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

/**
 * Výdělek za formulář = VÝHRADNĚ součet výkonů (taskLines), nikdy docházkové hodiny OD–DO.
 * `_workType`, `_hourlyItem` a `_hours` se už do výpočtu nepromítají – ponechány v podpisu funkce,
 * aby nebylo nutné upravovat stávající volající komponenty (AttendanceFormModal, DailyFormFields).
 * Docházka (OD–DO) je čistě evidenční údaj; pokud má pracovník dostávat zaplaceno za hodinovou
 * práci, musí být explicitně zadána jako výkon "Hodinová práce" s konkrétním počtem hodin.
 */
export function calculateFormEarnings(
  _workType: WorkType,
  _hourlyItem: WorkerPriceItem | null,
  _hours: number,
  taskLines: TaskLineInput[],
  priceItems: WorkerPriceItem[]
): number {
  return calculatePerformanceEarnings(taskLines, priceItems)
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
