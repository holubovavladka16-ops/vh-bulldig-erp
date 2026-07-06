import { fetchGpsPhotos } from '@/lib/photos/api'
import type { GpsPhoto } from '@/types/photos'

export type DiaryPhotoPickerMode = 'day' | 'order' | 'all_day'

function mergePhotos(...lists: GpsPhoto[][]): GpsPhoto[] {
  const map = new Map<string, GpsPhoto>()
  for (const list of lists) {
    for (const photo of list) {
      map.set(photo.id, photo)
    }
  }
  return [...map.values()].sort((a, b) => b.captured_at.localeCompare(a.captured_at))
}

function filterAvailablePhotos(photos: GpsPhoto[], currentDiaryEntryId?: string | null): GpsPhoto[] {
  return photos.filter((p) => !p.diary_entry_id || p.diary_entry_id === currentDiaryEntryId)
}

/** Fotky z modulu Fotodokumentace pro výběr ve stavebním deníku */
export async function fetchDiaryPickerPhotos(
  orderId: string,
  entryDate: string,
  mode: DiaryPhotoPickerMode,
  currentDiaryEntryId?: string | null
): Promise<GpsPhoto[]> {
  let photos: GpsPhoto[] = []

  if (mode === 'day') {
    const [byOrderDay, byDay] = await Promise.all([
      orderId ? fetchGpsPhotos({ orderId, dateFrom: entryDate, dateTo: entryDate }) : Promise.resolve([]),
      fetchGpsPhotos({ dateFrom: entryDate, dateTo: entryDate }),
    ])
    photos = mergePhotos(byOrderDay, byDay)
  } else if (mode === 'all_day') {
    photos = await fetchGpsPhotos({ dateFrom: entryDate, dateTo: entryDate })
  } else {
    photos = orderId ? await fetchGpsPhotos({ orderId }) : await fetchGpsPhotos({})
  }

  return filterAvailablePhotos(photos, currentDiaryEntryId)
}
