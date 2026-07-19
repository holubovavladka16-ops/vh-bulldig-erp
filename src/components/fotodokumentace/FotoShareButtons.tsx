import { Copy, Mail, MessageCircle, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  kopirovatOdkaz,
  sdiletFotografii,
  sdiletPresEmail,
  sdiletPresMessenger,
  sdiletPresWhatsApp,
} from '@/lib/fotodokumentace/share'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import type { FotoDokument } from '@/types/fotodokumentace'

interface FotoShareButtonsProps {
  foto: FotoDokument
  onMessage?: (msg: string) => void
  compact?: boolean
}

export function FotoShareButtons({ foto, onMessage, compact = false }: FotoShareButtonsProps) {
  const { settings: company } = useCompanySettings()

  async function handleCopy() {
    await kopirovatOdkaz(foto)
    onMessage?.('Odkaz zkopírován.')
  }

  async function handleNativeShare() {
    const ok = await sdiletFotografii(foto, company)
    onMessage?.(ok ? 'Sdíleno (PDF).' : 'Sdílení se nezdařilo.')
  }

  const btnClass = compact ? 'justify-center' : 'justify-center flex-1'

  return (
    <div className={compact ? 'grid grid-cols-2 gap-2' : 'flex flex-wrap gap-2'}>
      <Button variant="primary" size="sm" className={btnClass} onClick={handleNativeShare}>
        <Share2 className="h-4 w-4" />
        Sdílet
      </Button>
      <Button variant="secondary" size="sm" className={btnClass} onClick={() => sdiletPresWhatsApp(foto)}>
        <MessageCircle className="h-4 w-4 text-green-400" />
        WhatsApp
      </Button>
      <Button variant="secondary" size="sm" className={btnClass} onClick={() => sdiletPresMessenger(foto)}>
        <MessageCircle className="h-4 w-4 text-blue-400" />
        Messenger
      </Button>
      <Button variant="secondary" size="sm" className={btnClass} onClick={() => sdiletPresEmail(foto)}>
        <Mail className="h-4 w-4" />
        E-mail
      </Button>
      <Button variant="secondary" size="sm" className={btnClass} onClick={handleCopy}>
        <Copy className="h-4 w-4" />
        Kopírovat odkaz
      </Button>
    </div>
  )
}
