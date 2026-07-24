import { formatDate } from '@/constants/workers'
import type { ConstructionDiaryDetail } from '@/types/diary'
import { buildDiaryReportTitle } from '@/lib/diary/diaryReport'
import { formatDiaryWeather } from '@/constants/diary'

export function buildDiaryShareText(entry: ConstructionDiaryDetail): string {
  const weather =
    entry.weather ||
    formatDiaryWeather(entry.weather_type, entry.temperature_celsius)

  return [
    buildDiaryReportTitle(entry),
    '',
    entry.entry_number != null ? `Číslo zápisu: ${entry.entry_number}` : '',
    `Datum: ${formatDate(entry.entry_date)}`,
    `Zakázka: ${entry.order_name ?? '—'}`,
    `Místo: ${entry.site_location || '—'}`,
    `Počasí: ${weather || '—'}`,
    `Počet dělníků: ${entry.worker_count}`,
    `Zaměstnanci: ${entry.worker_names}`,
    `Technika: ${entry.equipment || '—'}`,
    `Materiál: ${entry.material || '—'}`,
    '',
    'Popis prací:',
    entry.work_description,
    entry.note ? `\nPoznámka: ${entry.note}` : '',
    entry.extraordinary_events ? `\nMimořádné události: ${entry.extraordinary_events}` : '',
    '',
    `Fotografií: ${entry.photos.length}`,
    '',
    'PDF report stavebního deníku exportujte v ERP (tlačítko PDF) a přiložte ke sdílení.',
  ]
    .filter(Boolean)
    .join('\n')
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
