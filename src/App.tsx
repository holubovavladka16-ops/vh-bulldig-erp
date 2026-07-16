import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@/context/ThemeContext'
import { SystemHealthProvider } from '@/context/SystemHealthContext'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { AppSettingsProvider } from '@/context/AppSettingsContext'
import { CompanySettingsProvider } from '@/context/CompanySettingsContext'
import { AppRoutes } from '@/routes/AppRoutes'
import { WelcomeGreeting } from '@/components/auth/WelcomeGreeting'
import { AppDesignBootstrap } from '@/components/theme/AppDesignBootstrap'

/**
 * Vykresluje se JAKO SOUROZENEC <AppRoutes/> (ne uvnitř žádné konkrétní stránky), takže uvítací
 * overlay leží nad celou aplikací bez ohledu na to, jaká trasa/stránka je zrovna aktivní.
 * justSignedIn se nastavuje výhradně uvnitř AuthContext.signIn() při skutečně novém přihlášení -
 * nikdy při obnovení stránky nebo obnově existující session.
 */
function WelcomeOverlayHost() {
  const { justSignedIn, clearJustSignedIn, profile } = useAuth()

  if (!justSignedIn) return null

  console.log('[AUTH DIAGNOSTIKA] App.tsx: justSignedIn=true → vykresluji WelcomeOverlayHost nad celou appkou', {
    timestamp: new Date().toISOString(),
  })

  return <WelcomeGreeting displayName={profile?.full_name} onDone={clearJustSignedIn} />
}

export function App() {
  return (
    <ThemeProvider>
      <AppDesignBootstrap />
      <BrowserRouter>
        <SystemHealthProvider>
          <AuthProvider>
            <AppSettingsProvider>
              <CompanySettingsProvider>
                <AppRoutes />
                <WelcomeOverlayHost />
              </CompanySettingsProvider>
            </AppSettingsProvider>
          </AuthProvider>
        </SystemHealthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
