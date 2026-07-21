import {
  createGpsPhoto,
  deleteGpsPhoto,
  fetchGpsPhotoDetail,
  fetchGpsPhotos,
  updateGpsPhotoLinks,
} from '@/lib/photos/api'
import { supabase } from '@/lib/supabase'
import type { GpsPhotoDetail, GpsPhotoFilters } from '@/types/photos'
import type {
  AuthorOption,
  GpsFotoarchivEditInput,
  GpsFotoarchivFilters,
  GpsFotoarchivPhoto,
  GpsFotoarchivSaveInput,
} from '@/types/gpsFotoarchiv'

export function getDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Neznámé zařízení'
  const ua = navigator.userAgent
  if (/iPhone/i.test(ua)) return 'iPhone'
  if (/iPad/i.test(ua)) return 'iPad'
  if (/Android/i.test(ua)) {
    const match = ua.match(/Android[^;]*;\s*([^)]+)\)/)
    return match?.[1]?.trim() || 'Android'
  }
  if (/Windows/i.test(ua)) return 'Windows'
  if (/Macintosh/i.test(ua)) return 'Mac'
  if (/Linux/i.test(ua)) return 'Linux'
  return ua.slice(0, 80)
}

export async function fetchArchivePhotos(filters: GpsFotoarchivFilters = {}): Promise<GpsFotoarchivPhoto[]> {
  const { search, ...dbFilters } = filters
  const photos = await fetchGpsPhotos(dbFilters as GpsPhotoFilters)

  if (!search?.trim()) return photos

  const q = search.trim().toLowerCase()
  return photos.filter((photo) => {
    const haystack = [
      photo.title,
      photo.note,
      photo.address_full,
      photo.order_name,
      photo.creator_name,
      photo.file_name,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}

export async function saveArchivePhoto(input: GpsFotoarchivSaveInput, createdBy: string): Promise<GpsFotoarchivPhoto> {
  return createGpsPhoto(
    {
      file: input.file,
      gps_lat: input.gps_lat,
      gps_lng: input.gps_lng,
      gps_accuracy: input.gps_accuracy,
      device_heading: input.device_heading ?? null,
      address_full: input.address_full,
      street: input.street,
      city: input.city,
      postal_code: input.postal_code,
      country: input.country,
      captured_at: input.captured_at,
      order_id: input.order_id,
      report_id: input.report_id ?? null,
      device_info: input.device_info,
    },
    createdBy
  )
}

export async function loadArchivePhotoDetail(id: string): Promise<GpsPhotoDetail> {
  return fetchGpsPhotoDetail(id)
}

export async function updateArchivePhoto(
  id: string,
  input: GpsFotoarchivEditInput,
  performedBy: string
): Promise<void> {
  await updateGpsPhotoLinks(id, input, performedBy)
}

export async function removeArchivePhoto(id: string, filePath: string, performedBy: string): Promise<void> {
  await deleteGpsPhoto(id, filePath, performedBy)
}

export async function fetchAuthorOptions(): Promise<AuthorOption[]> {
  const { data, error } = await supabase
    .from('gps_photos')
    .select('created_by, creator:profiles!gps_photos_created_by_fkey(full_name, email)')
    .not('created_by', 'is', null)

  if (error) throw new Error(error.message)

  type AuthorRow = {
    created_by: string
    creator: { full_name?: string; email?: string } | null
  }

  const map = new Map<string, string>()
  for (const row of (data ?? []) as AuthorRow[]) {
    const creator = row.creator as { full_name?: string; email?: string } | null
    const id = row.created_by as string
    const label = creator?.full_name?.trim() || creator?.email || 'Neznámý autor'
    if (!map.has(id)) map.set(id, label)
  }

  return Array.from(map.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'cs'))
}

export async function fetchDiaryEntryOptions(orderId?: string): Promise<{ value: string; label: string }[]> {
  let query = supabase
    .from('construction_diary_entries')
    .select('id, entry_date, entry_number, order_id, job_orders(name)')
    .order('entry_date', { ascending: false })
    .limit(100)

  if (orderId) query = query.eq('order_id', orderId)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  type DiaryRow = {
    id: string
    entry_date: string
    entry_number: number | null
    job_orders: { name?: string } | null
  }

  return ((data ?? []) as DiaryRow[]).map((row) => {
    const order = row.job_orders as { name?: string } | null
    const number = row.entry_number != null ? `č. ${row.entry_number}` : row.id.slice(0, 8)
    return {
      value: row.id as string,
      label: `${row.entry_date} · ${order?.name ?? '—'} · Zápis ${number}`,
    }
  })
}
