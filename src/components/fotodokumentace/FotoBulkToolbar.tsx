import { FileText, Link2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { vytvoritVerejnouGalerii } from '@/lib/fotodokumentace/api'
import { vytvoritFotodokumentPdf } from '@/lib/fotodokumentace/pdf'
import { kopirovatText } from '@/lib/fotodokumentace/share'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import type { FotoDokument } from '@/types/fotodokumentace'

interface FotoBulkToolbarProps {
  selected: FotoDokument[]
  userId: string
  onClear: () => void
  onMessage: (msg: string) => void
}

export function FotoBulkToolbar({ selected, userId, onClear, onMessage }: FotoBulkToolbarProps) {
  const { settings: company } = useCompanySettings()

  if (selected.length === 0) return null

  async function handleBulkPdf() {
    const blob = await vytvoritFotodokumentPdf(selected, company)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `fotodokumentace_${selected.length}_fotek.pdf`
    a.click()
    URL.revokeObjectURL(a.href)
    onMessage(`PDF exportováno (${selected.length} fotografií).`)
  }

  async function handlePublicGallery() {
    const orderId = selected[0]?.order_id
    if (!orderId) {
      onMessage('Vyberte fotografie ze stejné zakázky.')
      return
    }
    if (selected.some((f) => f.order_id !== orderId)) {
      onMessage('Veřejná galerie vyžaduje fotografie ze stejné zakázky.')
      return
    }
    try {
      const { url } = await vytvoritVerejnouGalerii(
        orderId,
        selected.map((f) => f.id),
        userId,
        { allowDownload: true, showAddress: true, showGps: false }
      )
      await kopirovatText(url)
      onMessage(`Veřejná galerie vytvořena – odkaz zkopírován (${selected.length} fotek).`)
    } catch (err) {
      onMessage(err instanceof Error ? err.message : 'Galerii se nepodařilo vytvořit.')
    }
  }

  return (
    <div className="sticky top-0 z-10 mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--accent-primary)]/40 bg-[var(--bg-glass)] p-3 backdrop-blur-md">
      <p className="text-sm font-medium text-theme-primary">
        Vybráno: {selected.length} {selected.length === 1 ? 'fotografie' : 'fotografií'}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={handleBulkPdf}>
          <FileText className="h-4 w-4" />
          Bulk PDF A4
        </Button>
        <Button size="sm" variant="secondary" onClick={handlePublicGallery}>
          <Link2 className="h-4 w-4" />
          Veřejná galerie
        </Button>
        <Button size="sm" variant="ghost" onClick={onClear}>
          Zrušit výběr
        </Button>
      </div>
    </div>
  )
}

export function FotoBulkToolbarLoading() {
  return (
    <div className="flex items-center gap-2 text-sm text-theme-muted">
      <Loader2 className="h-4 w-4 animate-spin" />
      Připravuji export…
    </div>
  )
}
