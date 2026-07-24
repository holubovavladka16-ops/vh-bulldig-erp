import { useEffect, useState } from 'react'

import { DataTable, DataTableRow, DataTableCell } from '@/components/ui/DataTable'

import { fetchHistory } from '@/lib/workers/api'

import { formatHistoryAction, formatHistoryDetails } from '@/lib/workers/historyFormat'

import type { WorkerHistoryEntry } from '@/types/workers'

import { formatDate } from '@/constants/workers'



interface HistoryTabProps {

  workerId: string

}



export function HistoryTab({ workerId }: HistoryTabProps) {

  const [entries, setEntries] = useState<WorkerHistoryEntry[]>([])

  const [loading, setLoading] = useState(true)



  useEffect(() => {

    fetchHistory(workerId).then(setEntries).finally(() => setLoading(false))

  }, [workerId])



  if (loading) {

    return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" /></div>

  }



  return (

    <DataTable

      columns={[

        { key: 'date', label: 'Datum' },

        { key: 'action', label: 'Akce' },

        { key: 'details', label: 'Detail' },

      ]}

      isEmpty={entries.length === 0}

      emptyMessage="Žádná historie."

    >

      {entries.map((e) => (

        <DataTableRow key={e.id}>

          <DataTableCell>{formatDate(e.created_at)}</DataTableCell>

          <DataTableCell>{formatHistoryAction(e.action)}</DataTableCell>

          <DataTableCell className="text-theme-muted text-xs">

            {formatHistoryDetails(e)}

          </DataTableCell>

        </DataTableRow>

      ))}

    </DataTable>

  )

}

