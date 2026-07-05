import { formatDate } from '@/constants/workers'
import type { ConstructionDiaryDetail } from '@/types/diary'
import { buildDiaryReportTitle } from '@/lib/diary/diaryReport'

export function buildDiaryShareText(entry: ConstructionDiaryDetail): string {
  return [
    buildDiaryReportTitle(entry),
    '',
    `Datum: ${formatDate(entry.entry_date)}`,
    `Zakázka: ${entry.order_name ?? '—'}`,
    `Počasí: ${entry.weather}`,
    `Počet dělníků: ${entry.worker_count}`,
    `Zaměstnanci: ${entry.worker_names}`,
    `Technika: ${entry.equipment}`,
    '',
    'Popis prací:',
    entry.work_description,
    '',
    `Fotografií: ${entry.photos.length}`,
    '',
    'PDF report stavebního deníku exportujte v ERP (tlačítko PDF) a přiložte ke sdílení.',
  ].join('\n')
}

export function getWhatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

export function getMessengerShareUrl(text: string): string {
  const redirect = encodeURIComponent(window.location.href)
  return `https://www.facebook.com/dialog/send?app_id=0&redirect_uri=${redirect}&quote=${encodeURIComponent(text)}`
}

export function getEmailShareUrl(text: string, subject: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`
}
