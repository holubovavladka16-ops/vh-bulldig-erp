import { useCompanySettings } from '@/context/CompanySettingsContext'
import { DEFAULT_APP_LOGO_URL } from '@/constants/branding'

interface CompanyLogoProps {
  className?: string
  alt?: string
  /** Preferuje nahrané logo firmy, jinak výchozí BULLDIG logo. */
  preferCompany?: boolean
}

export function CompanyLogo({
  className = 'h-10 w-auto max-w-[120px] object-contain',
  alt = 'VH Bulldig logo',
  preferCompany = true,
}: CompanyLogoProps) {
  const { settings } = useCompanySettings()
  const src =
    preferCompany && settings?.logo_url?.trim()
      ? settings.logo_url
      : DEFAULT_APP_LOGO_URL

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={(e) => {
        const img = e.currentTarget
        if (img.src.includes(DEFAULT_APP_LOGO_URL)) return
        img.src = DEFAULT_APP_LOGO_URL
      }}
    />
  )
}
