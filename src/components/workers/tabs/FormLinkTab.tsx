import { useState } from 'react'
import { Copy, Mail, MessageCircle, Send, Check, RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Worker } from '@/types/workers'
import { adminRegeneratePortalToken } from '@/lib/workers/api'
import {
  buildFormLinkShareMessage,
  getFormLinkEmailUrl,
  getFormLinkWhatsAppUrl,
  getPortalShareUrl,
} from '@/lib/workers/formLinkShare'
import { shareToMessenger } from '@/lib/share/webShare'

interface FormLinkTabProps {
  worker: Worker
  onWorkerUpdated?: (worker: Worker) => void
}

export function FormLinkTab({ worker, onWorkerUpdated }: FormLinkTabProps) {
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [currentWorker, setCurrentWorker] = useState(worker)
  const portalUrl = getPortalShareUrl(currentWorker.portal_token)
  const message = buildFormLinkShareMessage(currentWorker.first_name, portalUrl)

  async function copyLink() {
    await navigator.clipboard.writeText(portalUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function regenerateLink() {
    if (!window.confirm('Vygenerovat nový odkaz? Starý odkaz přestane fungovat.')) return
    setRegenerating(true)
    try {
      const newToken = await adminRegeneratePortalToken(currentWorker.id)
      const updated = { ...currentWorker, portal_token: newToken }
      setCurrentWorker(updated)
      onWorkerUpdated?.(updated)
    } finally {
      setRegenerating(false)
    }
  }

  async function shareMessenger() {
    try {
      const result = await shareToMessenger(message, portalUrl)
      if (result === 'copied') {
        window.alert('Zpráva byla zkopírována do schránky – vložte ji prosím do Messengeru.')
      }
    } catch {
      window.alert('Sdílení do Messengeru se nezdařilo.')
    }
  }

  return (
    <Card>
      <h3 className="mb-2 text-lg font-semibold text-theme-primary">Formulář zaměstnance (denní výkaz)</h3>
      <p className="mb-6 text-sm text-theme-secondary">
        Jedinečný zabezpečený odkaz (UUID). Zaměstnanec nemá účet do ERP — vidí pouze svůj formulář, výkazy a přehled výdělku.
      </p>

      <Input label="Odkaz na portál" value={portalUrl} readOnly />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
        <Button variant="secondary" onClick={copyLink} className="w-full sm:w-auto">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Zkopírováno' : 'Kopírovat odkaz'}
        </Button>

        <a href={getFormLinkWhatsAppUrl(message, worker.phone)} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
          <Button variant="secondary" type="button" className="w-full">
            <MessageCircle className="h-4 w-4" />WhatsApp
          </Button>
        </a>

        <Button variant="secondary" type="button" onClick={() => void shareMessenger()} className="w-full sm:w-auto">
          <Send className="h-4 w-4" />Messenger
        </Button>

        <a href={getFormLinkEmailUrl(message, worker.email)} className="w-full sm:w-auto">
          <Button variant="secondary" type="button" className="w-full">
            <Mail className="h-4 w-4" />E-mail
          </Button>
        </a>

        <Button variant="ghost" onClick={regenerateLink} loading={regenerating} className="w-full sm:w-auto">
          <RefreshCw className="h-4 w-4" />
          Nový odkaz
        </Button>
      </div>
    </Card>
  )
}
