import type { FormCheckStats } from '@/types/formCheck'

interface FormCheckStatsPanelProps {
  stats: FormCheckStats
}

export function FormCheckStatsPanel({ stats }: FormCheckStatsPanelProps) {
  const items = [
    { label: 'Počet kontrol', value: stats.totalChecks },
    { label: 'Shody', value: stats.matchCount, color: 'text-green-600 dark:text-green-400' },
    { label: 'Neshody', value: stats.mismatchCount, color: 'text-red-600 dark:text-red-400' },
    {
      label: 'K ruční kontrole',
      value: stats.manualReviewCount,
      color: 'text-orange-600 dark:text-orange-400',
    },
    {
      label: 'Úspěšnost OCR',
      value: stats.ocrSuccessRate != null ? `${stats.ocrSuccessRate} %` : '—',
    },
    {
      label: 'Průměrná confidence',
      value: stats.averageConfidence != null ? `${stats.averageConfidence} %` : '—',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
        >
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{item.label}</p>
          <p className={`mt-1 text-2xl font-bold ${item.color ?? 'text-gray-900 dark:text-gray-100'}`}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  )
}
