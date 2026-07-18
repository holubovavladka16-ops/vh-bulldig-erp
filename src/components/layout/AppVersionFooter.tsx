import { APP_BUILD_LABEL } from '@/constants/branding'

/** Dočasná patička pro ověření nasazeného buildu na produkci / mobilu. */
export function AppVersionFooter() {
  return (
    <footer
      className="shrink-0 border-t border-[var(--border-glass)] bg-[var(--bg-glass)]/80 px-3 py-1.5 text-center text-[10px] tracking-wide text-theme-muted backdrop-blur-sm"
      aria-label={`Verze aplikace ${APP_BUILD_LABEL}`}
    >
      {APP_BUILD_LABEL}
    </footer>
  )
}
