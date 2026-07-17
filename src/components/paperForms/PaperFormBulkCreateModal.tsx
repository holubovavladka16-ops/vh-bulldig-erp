import { useState } from 'react'
import { Copy, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useAuth } from '@/context/AuthContext'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import { createAndPrintBulkBlankPaperForms } from '@/lib/paperForms/api'
import { MONTH_NAMES } from '@/constants/paperForms'
import { DEFAULT_COMPANY_SETTINGS } from '@/types'

interface PaperFormBulkCreateModalProps {
  open: boolean
  onClose: () => void
  onCreated: (formIds: string[]) => void
}

export function PaperFormBulkCreateModal({ open, onClose, onCreated }: PaperFormBulkCreateModalProps) {
  const { user } = useAuth()
  const { settings: companySettings } = useCompanySettings()
  const company = companySettings ?? { ...DEFAULT_COMPANY_SETTINGS, id: '', updated_at: '', updated_by: null }

  const now = new Date()
  const [month, setMonth] = useState(String(now.getMonth() + 1))
  const [year, setYear] = useState(String(now.getFullYear()))
  const [count, setCount] = useState('5')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const monthNumber = Number(month)
  const yearNumber = Number(year)
  const countNumber = Number(count)
  const canSubmit =
    monthNumber >= 1 &&
    monthNumber <= 12 &&
    yearNumber >= 2020 &&
    yearNumber <= 2100 &&
    countNumber >= 1 &&
    countNumber <= 50

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) {
      setError('Vyplňte měsíc, rok a počet formulářů (1–50)')
      return
    }

    setLoading(true)
    setError('')

    try {
      const formIds = await createAndPrintBulkBlankPaperForms(
        monthNumber,
        yearNumber,
        countNumber,
        company,
        user?.id ?? null
      )
      onCreated(formIds)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hromadný tisk se nezdařil')
    } finally {
      setLoading(false)
    }
  }

  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const y = now.getFullYear() - 1 + i
    return { value: String(y), label: String(y) }
  })

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="paper-form-bulk-title">
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal-panel modal-panel-md glass-panel neon-border flex max-h-[100dvh] flex-col overflow-hidden sm:max-h-[92vh]">
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-glass)] pb-4">
          <h2 id="paper-form-bulk-title" className="text-lg font-semibold text-theme-primary sm:text-xl">
            Varianta 2 — hromadný tisk
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/5" aria-label="Zavřít">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 scrollbar-premium">
          <p className="mb-4 text-sm text-theme-secondary">
            Vyberte měsíc, rok a počet prázdných formulářů. Systém vytvoří jeden vícestránkový PDF soubor — každá
            stránka má unikátní ID a QR kód. Po naskenování QR přiřadíte zaměstnance v záložce Import.
          </p>

          <form id="paper-form-bulk" onSubmit={handleSubmit} className="space-y-4">
            <Select
              label="Měsíc *"
              options={MONTH_NAMES.map((label, i) => ({ value: String(i + 1), label }))}
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              required
            />
            <Select
              label="Rok *"
              options={yearOptions}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              required
            />
            <Input
              label="Počet prázdných formulářů *"
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              required
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
          </form>
        </div>

        <div className="modal-footer shrink-0 border-t border-[var(--border-glass)] pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Zrušit
          </Button>
          <Button type="submit" form="paper-form-bulk" loading={loading} disabled={!canSubmit}>
            <Copy className="h-4 w-4" />
            Vytvořit a vytisknout PDF
          </Button>
        </div>
      </div>
    </div>
  )
}
