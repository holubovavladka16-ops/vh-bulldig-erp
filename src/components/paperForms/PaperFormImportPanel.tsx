import { useRef, useState } from 'react'
import { ScanLine, Upload, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import {
  assignPaperFormWorker,
  markPaperFormScanned,
  resolvePaperFormByPublicId,
  uploadPaperFormScan,
} from '@/lib/paperForms/api'
import { extractPaperFormFromImage } from '@/lib/paperForms/aiExtract'
import type { PaperFormAiLine, PaperMonthlyForm } from '@/types/paperForms'
import { formatPaperPeriod } from '@/constants/paperForms'

interface PaperFormImportPanelProps {
  form: PaperMonthlyForm
  workers: { value: string; label: string }[]
  onAssigned: () => void
  onOcrComplete: (payload: {
    lines: PaperFormAiLine[]
    summary: Record<string, unknown>
    aiRaw: Record<string, unknown>
    confidence: number | null
    model: string
    scanPath: string
  }) => void
}

export function PaperFormImportPanel({
  form,
  workers,
  onAssigned,
  onOcrComplete,
}: PaperFormImportPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [qrInput, setQrInput] = useState(form.form_number)
  const [resolvedLabel, setResolvedLabel] = useState('')
  const [needsWorker, setNeedsWorker] = useState(!form.worker_id)
  const [selectedWorker, setSelectedWorker] = useState(form.worker_id ?? '')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [scanPath, setScanPath] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleResolveQr() {
    setBusy(true)
    setError('')
    try {
      const resolved = await resolvePaperFormByPublicId(qrInput)
      if (!resolved) {
        setError('Formulář s tímto QR ID nebyl nalezen')
        return
      }
      if (resolved.id !== form.id) {
        setError(`QR patří jinému formuláři: ${resolved.form_number}`)
        return
      }
      setResolvedLabel(
        `${resolved.form_number} · ${formatPaperPeriod(resolved.month, resolved.year)} · ${resolved.worker_name ?? 'bez pracovníka'}`
      )
      setNeedsWorker(Boolean(resolved.needs_worker_assignment))
      if (resolved.worker_id) setSelectedWorker(resolved.worker_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Načtení QR se nezdařilo')
    } finally {
      setBusy(false)
    }
  }

  async function handleAssignFromQr() {
    if (!selectedWorker) return
    setBusy(true)
    setError('')
    try {
      await assignPaperFormWorker(form.id, selectedWorker)
      setNeedsWorker(false)
      onAssigned()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Přiřazení se nezdařilo')
    } finally {
      setBusy(false)
    }
  }

  async function handleUpload(file: File) {
    setBusy(true)
    setError('')
    try {
      const path = await uploadPaperFormScan(form.id, file)
      await markPaperFormScanned(form.id, path)
      setPendingFile(file)
      setScanPath(path)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nahrání souboru se nezdařilo')
    } finally {
      setBusy(false)
    }
  }

  async function handleRunOcr() {
    if (!pendingFile) {
      setError('Nejdříve nahrajte fotografii nebo PDF')
      return
    }
    if (needsWorker || !form.worker_id) {
      setError('Nejdříve přiřaďte pracovníka (první načtení QR)')
      return
    }
    setBusy(true)
    setError('')
    try {
      const ai = await extractPaperFormFromImage(pendingFile, form.order_legend, form.month, form.year)
      onOcrComplete({
        lines: ai.lines,
        summary: ai.summary,
        aiRaw: ai as unknown as Record<string, unknown>,
        confidence: ai.overall_confidence ?? null,
        model: ai.ai_model ?? 'gemini',
        scanPath: scanPath ?? '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OCR se nezdařilo')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <label className="mb-1 block text-sm text-theme-muted">1. Načíst QR kód (obsahuje pouze ID formuláře)</label>
        <div className="flex flex-wrap gap-2">
          <input
            className="min-w-[200px] flex-1 rounded-lg border border-[var(--border-glass)] bg-white/5 px-3 py-2 text-sm"
            value={qrInput}
            onChange={(e) => setQrInput(e.target.value)}
            placeholder="PMF-XXXXXXXX"
          />
          <Button variant="secondary" onClick={() => void handleResolveQr()} loading={busy}>
            <ScanLine className="h-4 w-4" />
            Načíst QR
          </Button>
        </div>
        {resolvedLabel && <p className="mt-2 text-sm text-green-400">{resolvedLabel}</p>}
      </div>

      {needsWorker && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="mb-2 text-sm text-amber-200">První načtení — přiřaďte pracovníka k tomuto formuláři.</p>
          <Select label="Pracovník" options={workers} value={selectedWorker} onChange={(e) => setSelectedWorker(e.target.value)} />
          <Button className="mt-3" onClick={() => void handleAssignFromQr()} loading={busy} disabled={!selectedWorker}>
            Potvrdit pracovníka
          </Button>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm text-theme-muted">2. Nahrát scan (foto, PDF, mobil)</label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleUpload(file)
          }}
        />
        <Button variant="secondary" onClick={() => fileRef.current?.click()} loading={busy}>
          <Upload className="h-4 w-4" />
          Nahrát soubor
        </Button>
        {pendingFile && (
          <p className="mt-2 text-sm text-theme-secondary">
            Nahraný soubor: {pendingFile.name} ({Math.round(pendingFile.size / 1024)} KB)
          </p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm text-theme-muted">3. Spustit OCR (až po nahrání)</label>
        <Button onClick={() => void handleRunOcr()} loading={busy} disabled={!pendingFile}>
          <Wand2 className="h-4 w-4" />
          Spustit OCR
        </Button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </Card>
  )
}
