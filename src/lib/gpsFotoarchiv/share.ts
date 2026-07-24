import { buildArchiveShareText, generateArchivePhotosPdf } from '@/lib/gpsFotoarchiv/pdfExport'
import { downloadPdfBlob, sharePdfFile } from '@/lib/print/pdfDownload'
import type { CompanyHeader } from '@/lib/print/printDocument'
import type { GpsPhoto } from '@/types/photos'

function encode(text: string): string {
  return encodeURIComponent(text)
}

export function shareViaWhatsApp(text: string): void {
  window.open(`https://wa.me/?text=${encode(text)}`, '_blank', 'noopener,noreferrer')
}

export function shareViaMessenger(text: string): void {
  window.open(`https://www.facebook.com/dialog/send?link=${encode(text)}&app_id=0&redirect_uri=${encode(window.location.href)}`, '_blank', 'noopener,noreferrer')
}

export function shareViaEmail(text: string, subject = 'Fotodokumentace s GPS – VH Bulldig'): void {
  window.location.href = `mailto:?subject=${encode(subject)}&body=${encode(text)}`
}

export async function sharePhotoAsPdf(
  photo: GpsPhoto,
  company?: CompanyHeader | null
): Promise<'shared' | 'downloaded'> {
  const fileName = `foto-${photo.captured_date}.pdf`
  const blob = await generateArchivePhotosPdf([photo], company)
  const result = await sharePdfFile(blob, fileName)
  if (result === 'unsupported') downloadPdfBlob(blob, fileName)
  return result === 'shared' ? 'shared' : 'downloaded'
}

export async function sharePhotosAsPdf(
  photos: GpsPhoto[],
  company?: CompanyHeader | null
): Promise<'shared' | 'downloaded'> {
  const fileName = `fotodokumentace-${photos[0]?.captured_date ?? 'export'}.pdf`
  const blob = await generateArchivePhotosPdf(photos, company)
  const result = await sharePdfFile(blob, fileName)
  if (result === 'unsupported') downloadPdfBlob(blob, fileName)
  return result === 'shared' ? 'shared' : 'downloaded'
}

export function sharePhotoText(photo: GpsPhoto): void {
  const text = buildArchiveShareText(photo)
  if (typeof navigator.share === 'function') {
    void navigator.share({ title: 'Fotodokumentace s GPS', text }).catch(() => {
      shareViaWhatsApp(text)
    })
    return
  }
  shareViaWhatsApp(text)
}
