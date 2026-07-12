import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@/context/ThemeContext'
import { SystemHealthProvider } from '@/context/SystemHealthContext'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { AppSettingsProvider } from '@/context/AppSettingsContext'
import { CompanySettingsProvider } from '@/context/CompanySettingsContext'
import { AppRoutes } from '@/routes/AppRoutes'
import { WelcomeScreen } from '@/components/auth/WelcomeScreen'

function AppContent() {
  const { showWelcome, hideWelcome } = useAuth()

  return (
    <>
      {showWelcome && <WelcomeScreen onComplete={hideWelcome} />}
      <AppRoutes />
    </>
  )
}

export function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <SystemHealthProvider>
          <AuthProvider>
            <AppSettingsProvider>
              <CompanySettingsProvider>
                <AppContent />
              </CompanySettingsProvider>
            </AppSettingsProvider>
          </AuthProvider>
        </SystemHealthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
