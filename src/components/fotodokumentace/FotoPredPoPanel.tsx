import { useEffect, useState } from 'react'
import { ArrowLeftRight, FileText } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { fetchFotodokumenty, getFotoUrl, upravitFotodokument } from '@/lib/fotodokumentace/api'
import { vytvoritPredPoPdf } from '@/lib/fotodokumentace/pdf'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import type { FotoDokument } from '@/types/fotodokumentace'

interface FotoPredPoPanelProps {
  foto: FotoDokument
  userId: string
  onUpdated: () => void
}

export function FotoPredPoPanel({ foto, userId, onUpdated }: FotoPredPoPanelProps) {
  const { settings: company } = useCompanySettings()
  const [paired, setPaired] = useState<FotoDokument | null>(null)
  const [candidates, setCandidates] = useState<{ value: string; label: string }[]>([])
  const [selectedId, setSelectedId] = useState(foto.paired_photo_id ?? '')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!foto.order_id) return
    void fetchFotodokumenty({ orderId: foto.order_id }).then((list) => {
      setCandidates([
        { value: '', label: '— Vyberte druhou fotografii —' },
        ...list
          .filter((f) => f.id !== foto.id)
          .map((f) => ({
            value: f.id,
            label: `${f.captured_date} ${f.captured_time} · ${f.photo_type ?? '—'}`,
          })),
      ])
    })
  }, [foto.id, foto.order_id])

  useEffect(() => {
    if (!foto.paired_photo_id) {
      setPaired(null)
      return
    }
    void fetchFotodokumenty({ orderId: foto.order_id ?? undefined }).then((list) => {
      setPaired(list.find((f) => f.id === foto.paired_photo_id) ?? null)
    })
  }, [foto.paired_photo_id, foto.order_id])

  async function handlePair() {
    if (!selectedId) return
    setBusy(true)
    try {
      await upravitFotodokument(foto.id, { paired_photo_id: selectedId }, userId)
      await upravitFotodokument(selectedId, { paired_photo_id: foto.id }, userId)
      onUpdated()
    } finally {
      setBusy(false)
    }
  }

  async function handlePredPoPdf() {
    if (!paired) return
    const blob = await vytvoritPredPoPdf(foto, paired, company)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `pred_po_${foto.file_name.replace(/\.[^.]+$/, '')}.pdf`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const compareWith = paired ?? (selectedId ? candidates.find((c) => c.value === selectedId) : null)

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border-glass)] bg-white/5 p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-theme-primary">
        <ArrowLeftRight className="h-4 w-4" />
        Před / po porovnání
      </p>

      {paired ? (
        <div className="grid grid-cols-2 gap-2">
          <img src={getFotoUrl(foto.file_path)} alt="A" className="rounded-lg object-cover aspect-[4/3]" />
          <img src={getFotoUrl(paired.file_path)} alt="B" className="rounded-lg object-cover aspect-[4/3]" />
        </div>
      ) : (
        <Select
          label="Spárovat s fotografií"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          options={candidates}
        />
      )}

      <div className="flex flex-wrap gap-2">
        {!paired && selectedId && (
          <Button variant="secondary" size="sm" onClick={handlePair} disabled={busy}>
            Spárovat fotografie
          </Button>
        )}
        {(paired || selectedId) && (
          <Button variant="secondary" size="sm" onClick={handlePredPoPdf} disabled={!paired}>
            <FileText className="h-4 w-4" />
            PDF před/po
          </Button>
        )}
      </div>

      {compareWith && !paired && (
        <p className="text-xs text-theme-muted">Po spárování bude dostupný export PDF před/po.</p>
      )}
    </div>
  )
}
