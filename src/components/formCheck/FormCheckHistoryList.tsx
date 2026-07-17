import { Link } from 'react-router-dom'
import { FormCheckOutcomeBadge } from '@/components/formCheck/FormCheckOutcomeBadge'
import type { FormCheckRecordListItem } from '@/types/formCheck'

interface FormCheckHistoryListProps {
  records: FormCheckRecordListItem[]
  loading?: boolean
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function FormCheckHistoryList({ records, loading }: FormCheckHistoryListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 py-12 text-center dark:border-gray-600 dark:bg-gray-800/50">
        <p className="text-gray-500 dark:text-gray-400">Žádné kontroly neodpovídají zadaným filtrům.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Datum</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Zaměstnanec</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Formulář</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Výsledek</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Rozdíly</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Uživatel</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
            {records.map((record) => (
              <tr
                key={record.id}
                className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <Link
                    to={`/kontrola-formulare/historie/${record.id}`}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {formatDateTime(record.checkedAt)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{record.workerName}</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{record.formNumber}</td>
                <td className="px-4 py-3">
                  <FormCheckOutcomeBadge outcome={record.outcome} />
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{record.differenceCount}</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{record.checkedByName ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
