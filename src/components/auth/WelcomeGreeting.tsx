import { useEffect, useState } from 'react'
import { CompanyLogo } from '@/components/ui/CompanyLogo'

interface WelcomeGreetingProps {
  onDone: () => void
  displayName?: string
}

const DURATION_MS = 10000
const FADE_MS = 400

/**
 * Celoobrazovkový overlay zobrazený VÝHRADNĚ po skutečně novém přihlášení (řídí
 * AuthContext.justSignedIn – nastavuje se pouze uvnitř signIn(), nikdy při obnově existující
 * session/refreshi stránky). Vykresluje se v App.tsx NAD veškerým routováním, ne uvnitř
 * konkrétní stránky, takže je to opravdu overlay nad celou aplikací.
 */
export function WelcomeGreeting({ onDone, displayName }: WelcomeGreetingProps) {
  const [leaving, setLeaving] = useState(false)
  const [barShrunk, setBarShrunk] = useState(false)

  useEffect(() => {
    console.log('[AUTH DIAGNOSTIKA] WelcomeGreeting: komponenta se vykreslila (mount)', {
      displayName,
      durationMs: DURATION_MS,
      timestamp: new Date().toISOString(),
    })

    const startBar = requestAnimationFrame(() => setBarShrunk(true))
    const leaveTimer = setTimeout(() => {
      console.log('[AUTH DIAGNOSTIKA] WelcomeGreeting: začíná mizet po', DURATION_MS, 'ms')
      setLeaving(true)
    }, DURATION_MS)
    const doneTimer = setTimeout(() => {
      console.log('[AUTH DIAGNOSTIKA] WelcomeGreeting: onDone() voláno, overlay se zavírá')
      onDone()
    }, DURATION_MS + FADE_MS)

    return () => {
      console.log('[AUTH DIAGNOSTIKA] WelcomeGreeting: unmount (cleanup)')
      cancelAnimationFrame(startBar)
      clearTimeout(leaveTimer)
      clearTimeout(doneTimer)
    }
  }, [onDone, displayName])

  function handleSkip() {
    console.log('[AUTH DIAGNOSTIKA] WelcomeGreeting: uživatel kliknul, přeskakuji')
    setLeaving(true)
    setTimeout(onDone, FADE_MS)
  }

  return (
    <div
      className={`fixed inset-0 z-[9999] flex min-h-dvh flex-col items-center justify-center gap-6 bg-[var(--bg-primary,#0a0e17)] p-6 text-center transition-opacity duration-[400ms] ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={handleSkip}
      role="status"
      aria-live="polite"
    >
      <CompanyLogo className="h-20 w-auto max-w-[220px] object-contain" />
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-theme-primary sm:text-3xl">
          Dobrý den{displayName ? `, ${displayName}` : ''}, vítejte.
        </h1>
        <p className="text-base text-theme-muted sm:text-lg">
          Přeji Vám krásný, úspěšný a bezpečný pracovní den.
        </p>
      </div>
      <div className="h-1 w-40 overflow-hidden rounded-full bg-[var(--border-glass)]">
        <div
          className="h-full bg-[var(--accent-primary)] ease-linear"
          style={{
            width: barShrunk ? '0%' : '100%',
            transition: `width ${DURATION_MS}ms linear`,
          }}
        />
      </div>
      <p className="text-xs text-theme-muted opacity-60">Klepnutím pokračujete ihned</p>
    </div>
  )
}
