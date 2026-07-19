import { supabase } from '@/lib/supabase'

const BUCKET = 'gps-photos'

export interface FotoStoragePaths {
  original: string
  display: string
  thumbnail: string | null
  watermarked: string | null
}

export function buildStoragePaths(
  orderId: string,
  capturedAt: Date,
  fileName: string
): FotoStoragePaths {
  const year = capturedAt.getFullYear()
  const month = String(capturedAt.getMonth() + 1).padStart(2, '0')
  const uid = crypto.randomUUID().slice(0, 8)
  const base = `${orderId}/${year}/${month}/${uid}`
  const stem = fileName.replace(/\.[^.]+$/, '')

  return {
    original: `${base}/${stem}_original.jpg`,
    display: `${base}/${fileName}`,
    thumbnail: `${base}/${stem}_thumb.jpg`,
    watermarked: `${base}/${stem}_wm.jpg`,
  }
}

export async function uploadFotoFiles(
  paths: FotoStoragePaths,
  files: { original: File; thumbnail?: File; watermarked?: File }
): Promise<void> {
  const uploads: Array<{ path: string; file: File }> = [
    { path: paths.original, file: files.original },
    { path: paths.display, file: files.original },
  ]

  if (files.thumbnail && paths.thumbnail) {
    uploads.push({ path: paths.thumbnail, file: files.thumbnail })
  }
  if (files.watermarked && paths.watermarked) {
    uploads.push({ path: paths.watermarked, file: files.watermarked })
  }

  const uploadTasks = uploads.map(({ path, file }) =>
    supabase.storage.from(BUCKET).upload(path, file, {
      upsert: true,
      contentType: file.type || 'image/jpeg',
    })
  )

  const results = await Promise.all(uploadTasks)
  for (const { error } of results) {
    if (error) {
      throw new Error(`Nahrání souboru selhalo: ${error.message}`)
    }
  }
}

export async function stahnoutFotoSoubor(filePath: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(BUCKET).download(filePath)
  if (error || !data) throw new Error(error?.message ?? 'Soubor se nepodařilo stáhnout.')
  return data
}
