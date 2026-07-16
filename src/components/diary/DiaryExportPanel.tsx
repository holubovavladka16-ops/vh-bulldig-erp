import { useState } from 'react'
import { FileDown, Loader2, Mail, MessageCircle, Printer, Send } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import { fetchDiaryDetailsForExport, fetchDiaryDetail } from '@/lib/diary/api'
import {
  buildBulkDiaryReportTitle,
  buildDiaryReportTitle,
  downloadBulkDiaryReport,
  downloadDiaryReport,
  previewBulkDiaryReport,
  printBulkDiaryReport,
  printDiaryReport,
} from '@/lib/diary/diaryReport'
import {
  buildDiaryShareText,
  getEmailShareUrl,
  getWhatsAppShareUrl,
} from '@/lib/diary/share'
import { shareToMessenger } from '@/lib/share/webShare'
import type { DiaryExportOptions, DiaryExportScope } from '@/types/diary'

interface DiaryExportPanelProps {
  orderOptions: { value: string; label: string }[]
  defaultOrderId?: string
  defaultDateFrom?: string
  defaultDateTo?: string
  singleEntryId?: string | null
}

export function DiaryExportPanel({
  orderOptions,
  defaultOrderId,
  defaultDateFrom,
  defaultDateTo,
  singleEntryId,
}: DiaryExportPanelProps) {
  const { settings: company } = useCompanySettings()
  const [scope, setScope] = useState<DiaryExportScope>(singleEntryId ? 'period' : 'all')
  const [orderId, setOrderId] = useState(defaultOrderId ?? '')
  const [dateFrom, setDateFrom] = useState(defaultDateFrom ?? '')
  const [dateTo, setDateTo] = useState(defaultDateTo ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const orderSelectOptions = [{ value: '', label: 'Všechny zakázky' }, ...orderOptions]

  async function loadEntries() {
    if (singleEntryId) {
      const detail = await fetchDiaryDetail(singleEntryId)
      return detail ? [detail] : []
    }

    const options: DiaryExportOptions = { scope, orderId: orderId || undefined, dateFrom, dateTo }
    if (scope === 'order' && !orderId) throw new Error('Vyberte zakázku pro export.')
    if (scope === 'period' && (!dateFrom || !dateTo)) throw new Error('Vyberte období Od – Do.')
    return fetchDiaryDetailsForExport(options)
  }

  async function runExport(action: 'print' | 'download' | 'preview') {
    setError('')
    setLoading(true)
    try {
      const entries = await loadEntries()
      if (entries.length === 0) throw new Error('Žádné zápisy k exportu.')

      if (entries.length === 1) {
        if (action === 'print') printDiaryReport(entries[0], company)
        else if (action === 'download') downloadDiaryReport(entries[0], company)
        else previewBulkDiaryReport(entries, company)
      } else {
        if (action === 'print') printBulkDiaryReport(entries, company)
        else if (action === 'download') downloadBulkDiaryReport(entries, company)
        else previewBulkDiaryReport(entries, company)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export se nezdařil')
    } finally {
      setLoading(false)
    }
  }

  async function share(channel: 'whatsapp' | 'messenger' | 'email') {
    setError('')
    setLoading(true)
    try {
      const entries = await loadEntries()
      if (entries.length === 0) throw new Error('Žádné zápisy k exportu.')
      const entry = entries[0]
      const text =
        entries.length === 1
          ? buildDiaryShareText(entry)
          : `${buildBulkDiaryReportTitle(entries)}\n\nPočet zápisů: ${entries.length}\n\nOtevřete export PDF v ERP a uložte jako PDF (Ctrl+P → Uložit jako PDF).`
      const subject =
        entries.length === 1 ? buildDiaryReportTitle(entry) : buildBulkDiaryReportTitle(entries)

      if (entries.length === 1) printDiaryReport(entry, company)
      else printBulkDiaryReport(entries, company)

      if (channel === 'whatsapp') window.open(getWhatsAppShareUrl(text), '_blank')
      else if (channel === 'messenger') {
        const result = await shareToMessenger(text)
        if (result === 'copied') setError('Zpráva byla zkopírována do schránky – vložte ji prosím do Messengeru.')
      } else window.location.href = getEmailShareUrl(text, subject)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sdílení se nezdařilo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="mb-6 space-y-4">
      <div>
        <h3 className="font-semibold text-theme-primary">Export do PDF (A4)</h3>
        <p className="text-sm text-theme-muted">
          Profesionální PDF s logem, číslem zápisu, fotografiemi a GPS. Uložení: tisk → „Uložit jako PDF“.
        </p>
      </div>

      {!singleEntryId && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Rozsah exportu"
            options={[
              { value: 'all', label: 'Všechny zápisy' },
              { value: 'period', label: 'Období Od – Do' },
              { value: 'order', label: 'Konkrétní zakázka' },
            ]}
            value={scope}
            onChange={(e) => setScope(e.target.value as DiaryExportScope)}
          />
          <Select
            label="Zakázka"
            options={orderSelectOptions}
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            disabled={scope === 'all'}
          />
          <Input
            label="Datum od"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            disabled={scope !== 'period'}
          />
          <Input
            label="Datum do"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            disabled={scope !== 'period'}
          />
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => runExport('preview')} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          Náhled
        </Button>
        <Button type="button" size="sm" onClick={() => runExport('print')} disabled={loading}>
          <Printer className="h-4 w-4" />
          Tisk / PDF
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => runExport('download')} disabled={loading}>
          <FileDown className="h-4 w-4" />
          Stáhnout
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => share('whatsapp')} disabled={loading}>
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => share('messenger')} disabled={loading}>
          <Send className="h-4 w-4" />
          Messenger
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => share('email')} disabled={loading}>
          <Mail className="h-4 w-4" />
          E-mail
        </Button>
      </div>
    </Card>
  )
}
