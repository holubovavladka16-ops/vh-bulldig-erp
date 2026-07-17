import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { createPaperMonthlyForm } from '@/lib/paperForms/api'
import { MONTH_NAMES } from '@/constants/paperForms'

interface PaperFormCreateModalProps {
  open: boolean
  onClose: () => void
  onCreated: (formId: string) => void
}

export function PaperFormCreateModal({ open, onClose, onCreated }: PaperFormCreateModalProps) {
  const now = new Date()
  const [month, setMonth] = useState(String(now.getMonth() + 1))
  const [year, setYear] = useState(String(now.getFullYear()))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const id = await createPaperMonthlyForm(Number(month), Number(year))
      onCreated(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vytvoření formuláře se nezdařilo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="glass-panel w-full max-w-md rounded-2xl border border-[var(--border-glass)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-theme-primary">Nový papírový formulář</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-theme-muted hover:bg-white/5">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-sm text-theme-secondary">
          Zakázky se nevyplňují pro celý měsíc — každý den a každý výkon se eviduje zvlášť po importu.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Měsíc"
            options={MONTH_NAMES.map((label, i) => ({ value: String(i + 1), label }))}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          <Input label="Rok" type="number" min={2020} max={2100} value={year} onChange={(e) => setYear(e.target.value)} />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Zrušit
            </Button>
            <Button type="submit" loading={loading}>
              Vytvořit
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
