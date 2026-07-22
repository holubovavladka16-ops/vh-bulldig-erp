import { supabase } from '@/lib/supabase'
import type { ConstructionDiaryEntry } from '@/types/diary'
import type { DiaryEntryStatus } from '@/constants/diary'

export const PROJECT_DIARY_PAGE_SIZE = 20

export interface ProjectDiaryListItem extends ConstructionDiaryEntry {
  photo_count: number
}

export interface ProjectDiaryPageResult {
  entries: ProjectDiaryListItem[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

type DiaryPageRow = ConstructionDiaryEntry & {
  job_orders: { name: string; order_number: string | null } | null
  creator?: { full_name: string | null; email: string | null } | null
  gps_photos?: Array<{ count: number }> | null
}

function mapDiaryPageRow(row: DiaryPageRow): ProjectDiaryListItem {
  const photoCount = row.gps_photos?.[0]?.count ?? 0

  return {
    id: row.id,
    entry_number: row.entry_number != null ? Number(row.entry_number) : null,
    entry_date: row.entry_date,
    order_id: row.order_id,
    order_name: row.job_orders?.name ?? row.order_name,
    order_number: row.job_orders?.order_number ?? row.order_number ?? null,
    weather: row.weather,
    weather_type: row.weather_type ?? null,
    temperature_celsius: row.temperature_celsius != null ? Number(row.temperature_celsius) : null,
    site_location: row.site_location ?? '',
    worker_count: Number(row.worker_count),
    worker_names: row.worker_names,
    equipment: row.equipment,
    material: row.material ?? '',
    performances_summary: row.performances_summary ?? '',
    rough_work_description: row.rough_work_description ?? '',
    work_description: row.work_description,
    ai_work_description: row.ai_work_description ?? '',
    ai_assisted: Boolean(row.ai_assisted),
    note: row.note ?? '',
    extraordinary_events: row.extraordinary_events ?? '',
    entry_status: (row.entry_status as DiaryEntryStatus) ?? 'approved',
    creator_name:
      row.creator?.full_name?.trim() || row.creator?.email?.trim() || row.creator_name,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    photo_count: photoCount,
  }
}

/** Načte stránku zápisů stavebního deníku pro jednu zakázku (order_id = project_id). */
export async function fetchProjectDiaryPage(
  orderId: string,
  page: number,
  pageSize = PROJECT_DIARY_PAGE_SIZE
): Promise<ProjectDiaryPageResult> {
  if (!orderId.trim()) {
    return { entries: [], total: 0, page, pageSize, hasMore: false }
  }

  const safePage = Math.max(1, page)
  const from = (safePage - 1) * pageSize
  const to = from + pageSize - 1

  const { data, error, count } = await supabase
    .from('construction_diary_entries')
    .select(
      `
      *,
      job_orders(name, order_number),
      creator:profiles!construction_diary_entries_created_by_fkey(full_name, email),
      gps_photos(count)
    `,
      { count: 'exact' }
    )
    .eq('order_id', orderId)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) throw new Error(error.message)

  const total = count ?? 0
  const entries = ((data ?? []) as DiaryPageRow[]).map(mapDiaryPageRow)

  return {
    entries,
    total,
    page: safePage,
    pageSize,
    hasMore: from + entries.length < total,
  }
}

export { fetchDiaryDetail } from '@/lib/diary/api'
