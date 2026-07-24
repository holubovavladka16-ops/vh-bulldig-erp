import { User } from 'lucide-react'
import type { Worker } from '@/types/workers'
import { EMPLOYMENT_TYPE_LABELS, WORKER_STATUS_LABELS, formatDate } from '@/constants/workers'
import { DataTable, DataTableRow, DataTableCell } from '@/components/ui/DataTable'
import { StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Archive, ArchiveRestore, Eye, Trash2 } from 'lucide-react'

interface WorkerTableProps {
  workers: Worker[]
  onView: (id: string) => void
  onArchive: (id: string) => void
  onRestore: (id: string) => void
  onDelete: (id: string) => void
  isAdmin: boolean
}

export function WorkerTable({ workers, onView, onArchive, onRestore, onDelete, isAdmin }: WorkerTableProps) {
  return (
    <DataTable
      columns={[
        { key: 'photo', label: 'Fotografie', className: 'w-16' },
        { key: 'first_name', label: 'Jméno' },
        { key: 'last_name', label: 'Příjmení' },
        { key: 'position', label: 'Pracovní pozice' },
        { key: 'employment', label: 'Pracovní poměr' },
        { key: 'phone', label: 'Telefon' },
        { key: 'start_date', label: 'Datum nástupu' },
        { key: 'status', label: 'Stav' },
        { key: 'actions', label: 'Akce', className: 'text-right' },
      ]}
      isEmpty={workers.length === 0}
      emptyMessage="Žádní zaměstnanci neodpovídají zadaným kritériím."
    >
      {workers.map((worker) => (
        <DataTableRow key={worker.id}>
          <DataTableCell>
            {worker.photo_url ? (
              <img
                src={worker.photo_url}
                alt={`${worker.first_name} ${worker.last_name}`}
                className="h-10 w-10 rounded-full object-cover neon-border"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full neon-border bg-white/5">
                <User className="h-5 w-5 text-theme-muted" />
              </div>
            )}
          </DataTableCell>
          <DataTableCell>{worker.first_name}</DataTableCell>
          <DataTableCell>{worker.last_name}</DataTableCell>
          <DataTableCell>{worker.position}</DataTableCell>
          <DataTableCell>{EMPLOYMENT_TYPE_LABELS[worker.employment_type]}</DataTableCell>
          <DataTableCell>{worker.phone ?? '—'}</DataTableCell>
          <DataTableCell>{formatDate(worker.start_date)}</DataTableCell>
          <DataTableCell>
            <StatusBadge
              label={WORKER_STATUS_LABELS[worker.status]}
              variant={
                worker.status === 'aktivni' ? 'success' : worker.status === 'archiv' ? 'neutral' : 'warning'
              }
            />
          </DataTableCell>
          <DataTableCell className="text-right">
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="sm" onClick={() => onView(worker.id)} aria-label="Zobrazit">
                <Eye className="h-4 w-4" />
              </Button>
              {isAdmin && worker.status === 'aktivni' && (
                <Button variant="ghost" size="sm" onClick={() => onArchive(worker.id)} aria-label="Archivovat">
                  <Archive className="h-4 w-4" />
                </Button>
              )}
              {isAdmin && worker.status === 'archiv' && (
                <Button variant="ghost" size="sm" onClick={() => onRestore(worker.id)} aria-label="Obnovit">
                  <ArchiveRestore className="h-4 w-4" />
                </Button>
              )}
              {isAdmin && (
                <Button variant="danger" size="sm" onClick={() => onDelete(worker.id)} aria-label="Smazat">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </DataTableCell>
        </DataTableRow>
      ))}
    </DataTable>
  )
}
