import { ExternalLink, Mail, MessageCircle, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { sharePhotoAsPdf, sharePhotoText, shareViaEmail, shareViaMessenger, shareViaWhatsApp } from '@/lib/gpsFotoarchiv/share'
import { buildArchiveShareText } from '@/lib/gpsFotoarchiv/pdfExport'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import type { GpsPhoto } from '@/types/photos'

interface GfaShareActionsProps {
  photo: GpsPhoto
}

export function GfaShareActions({ photo }: GfaShareActionsProps) {
  const { settings } = useCompanySettings()
  const text = buildArchiveShareText(photo)

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" onClick={() => void sharePhotoAsPdf(photo, settings)}>
        <Share2 className="h-4 w-4" />
        PDF
      </Button>
      <Button size="sm" variant="secondary" onClick={() => shareViaWhatsApp(text)}>
        <MessageCircle className="h-4 w-4" />
        WhatsApp
      </Button>
      <Button size="sm" variant="secondary" onClick={() => shareViaMessenger(text)}>
        <ExternalLink className="h-4 w-4" />
        Messenger
      </Button>
      <Button size="sm" variant="secondary" onClick={() => shareViaEmail(text)}>
        <Mail className="h-4 w-4" />
        E-mail
      </Button>
      <Button size="sm" variant="ghost" onClick={() => sharePhotoText(photo)}>
        Systémové sdílení
      </Button>
    </div>
  )
}
