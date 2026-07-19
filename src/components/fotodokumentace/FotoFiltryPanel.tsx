import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { RYCHLE_FILTRY, VYCHOZI_TYPY_FOTOGRAFII } from '@/constants/fotodokumentace'
import type { FotoFiltry } from '@/types/fotodokumentace'

interface FotoFiltryPanelProps {
  filters: FotoFiltry
  onChange: (filters: FotoFiltry) => void
  orderOptions: { value: string; label: string }[]
  workerOptions: { value: string; label: string }[]
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function weekStartIso(): string {
  const d = new Date()
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1)
  return d.toISOString().slice(0, 10)
}

function monthStartIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export function FotoFiltryPanel({
  filters,
  onChange,
  orderOptions,
  workerOptions,
}: FotoFiltryPanelProps) {
  function applyQuick(id: string) {
    const base: FotoFiltry = { ...filters, dateExact: undefined, hasGps: undefined, noGps: undefined, approvalStatus: undefined }
    switch (id) {
      case 'dnes':
        onChange({ ...base, dateFrom: todayIso(), dateTo: todayIso() })
        break
      case 'tyden':
        onChange({ ...base, dateFrom: weekStartIso(), dateTo: todayIso() })
        break
      case 'mesic':
        onChange({ ...base, dateFrom: monthStartIso(), dateTo: todayIso() })
        break
      case '30dni':
        onChange({ ...base, dateFrom: daysAgoIso(30), dateTo: todayIso() })
        break
      case 'bez_gps':
        onChange({ ...base, noGps: true, hasGps: undefined })
        break
      case 'ke_kontrole':
        onChange({ ...base, approvalStatus: 'ke_kontrole' })
        break
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {RYCHLE_FILTRY.map((f) => (
          <button
            key={f.id}
            type="button"
            className="rounded-full border border-[var(--border-glass)] px-3 py-1 text-xs text-theme-secondary hover:border-[var(--accent-primary)]"
            onClick={() => applyQuick(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          label="Zakázka"
          value={filters.orderId ?? ''}
          onChange={(e) => onChange({ ...filters, orderId: e.target.value || undefined })}
          options={orderOptions}
        />
        <Select
          label="Zaměstnanec"
          value={filters.workerId ?? ''}
          onChange={(e) => onChange({ ...filters, workerId: e.target.value || undefined })}
          options={workerOptions}
        />
        <Select
          label="Typ fotografie"
          value={filters.photoType ?? ''}
          onChange={(e) => onChange({ ...filters, photoType: e.target.value || undefined })}
          options={[
            { value: '', label: 'Vše' },
            ...VYCHOZI_TYPY_FOTOGRAFII.map((t) => ({ value: t.code, label: t.label })),
          ]}
        />
        <Input
          label="Obec / adresa"
          value={filters.cityQuery ?? filters.addressQuery ?? ''}
          onChange={(e) => onChange({ ...filters, cityQuery: e.target.value || undefined })}
          placeholder="Hledat v adrese…"
        />
        <Input
          label="Od data"
          type="date"
          value={filters.dateFrom ?? ''}
          onChange={(e) => onChange({ ...filters, dateFrom: e.target.value || undefined })}
        />
        <Input
          label="Do data"
          type="date"
          value={filters.dateTo ?? ''}
          onChange={(e) => onChange({ ...filters, dateTo: e.target.value || undefined })}
        />
      </div>
    </div>
  )
}
