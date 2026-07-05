import { useState } from 'react'
import { X, Eye, Printer, FileDown, Mail, MessageCircle, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import { getGoogleMapsUrl, getOpenStreetMapEmbedUrl } from '@/lib/photos/mapLinks'
import { getReceiptPhotoUrl, deleteReceipt } from '@/lib/receipts/api'
import {
  downloadReceiptReportHtml,
  openReceiptReport,
  printReceiptReport,
} from '@/lib/receipts/receiptReport'
import { buildReceiptShareText, getEmailShareUrl, getWhatsAppShareUrl } from '@/lib/receipts/share'
import { formatCurrency, formatDate, formatTime } from '@/constants/workers'
import { DEFAULT_COMPANY_SETTINGS } from '@/types'
import type { Receipt } from '@/types/receipts'

interface ReceiptDetailModalProps {
  receipt: Receipt | null
  onClose: () => void
  onEdit: (receipt: Receipt) => void
  onDeleted: () => void
}

export function ReceiptDetailModal({ receipt, onClose, onEdit, onDeleted }: ReceiptDetailModalProps) {
  const { settings: companySettings } = useCompanySettings()
  const [deleting, setDeleting] = useState(false)

  if (!receipt) return null

  const company = companySettings ?? { ...DEFAULT_COMPANY_SETTINGS, id: '', updated_at: '', updated_by: null }
  const hasGps = receipt.gps_lat != null && receipt.gps_lng != null
  const shareText = buildReceiptShareText(receipt)

  async function handleDelete() {
    if (!receipt || !confirm('Trvale smazat tento paragon?')) return
    setDeleting(true)
    try {
      await deleteReceipt(receipt.id, receipt.file_path)
      onDeleted()
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal-panel modal-panel-2xl glass-panel neon-border scrollbar-premium">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-theme-primary">Detail paragonu</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/5" aria-label="Zavřít">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <img
              src={getReceiptPhotoUrl(receipt.file_path)}
              alt={receipt.file_name}
              className="w-full rounded-xl neon-border object-contain"
            />

            <div className="mt-4 grid gap-2 text-sm">
              <Info label="Datum" value={formatDate(receipt.receipt_date)} />
              <Info label="Zakázka" value={receipt.order_name ?? '—'} />
              <Info label="Název výdaje" value={receipt.expense_name} />
              <Info label="Cena" value={receipt.amount != null ? formatCurrency(receipt.amount) : '—'} />
              <Info label="Dodavatel" value={receipt.supplier || '—'} />
              <Info label="Poznámka" value={receipt.note || '—'} />
            </div>

            <div className="mt-4 grid gap-2 border-t border-[var(--border-glass)] pt-4 text-sm">
              <Info label="Datum pořízení" value={formatDate(receipt.captured_date)} />
              <Info label="Čas pořízení" value={formatTime(receipt.captured_time)} />
              <Info label="GPS" value={hasGps ? `${receipt.gps_lat!.toFixed(6)}, ${receipt.gps_lng!.toFixed(6)}` : '—'} />
              <Info label="Adresa" value={receipt.address_full || '—'} />
            </div>
          </div>

          <div className="space-y-6">
            {hasGps && (
              <Card>
                <h3 className="mb-3 font-semibold text-theme-primary">Mapa</h3>
                <iframe
                  title="Mapa"
                  src={getOpenStreetMapEmbedUrl(receipt.gps_lat!, receipt.gps_lng!)}
                  className="h-56 w-full rounded-xl border border-[var(--border-glass)]"
                  loading="lazy"
                />
                <a
                  href={getGoogleMapsUrl(receipt.gps_lat!, receipt.gps_lng!)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm text-accent hover:underline"
                >
                  Otevřít v Google Maps
                </a>
              </Card>
            )}

            <Card>
              <h3 className="mb-3 font-semibold text-theme-primary">Sdílení a export</h3>
              <div className="mb-3 flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => openReceiptReport(receipt, company)}>
                  <Eye className="h-4 w-4" />
                  Otevřít
                </Button>
                <Button variant="secondary" size="sm" onClick={() => downloadReceiptReportHtml(receipt, company)}>
                  <FileDown className="h-4 w-4" />
                  Stáhnout
                </Button>
                <Button variant="secondary" size="sm" onClick={() => printReceiptReport(receipt, company)}>
                  <Printer className="h-4 w-4" />
                  Export PDF A4
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={getWhatsAppShareUrl(shareText)} target="_blank" rel="noopener noreferrer">
                  <Button variant="secondary" size="sm" type="button">
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </Button>
                </a>
                <a href={getEmailShareUrl(shareText, company.accountant_email)}>
                  <Button variant="secondary" size="sm" type="button">
                    <Mail className="h-4 w-4" />
                    E-mail účetní
                  </Button>
                </a>
              </div>
              {!company.accountant_email && (
                <p className="mt-2 text-xs text-theme-muted">
                  Tip: e-mail účetní nastavíte v Nastavení společnosti.
                </p>
              )}
            </Card>

            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => onEdit(receipt)}>
                <Pencil className="h-4 w-4" />
                Upravit
              </Button>
              <Button variant="danger" onClick={handleDelete} loading={deleting}>
                <Trash2 className="h-4 w-4" />
                Smazat paragon
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="min-w-28 text-theme-muted">{label}:</span>
      <span className="text-theme-primary">{value}</span>
    </div>
  )
}
