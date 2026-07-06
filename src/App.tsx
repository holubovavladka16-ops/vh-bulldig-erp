import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@/context/ThemeContext'
import { SystemHealthProvider } from '@/context/SystemHealthContext'
import { AuthProvider } from '@/context/AuthContext'
import { AppSettingsProvider } from '@/context/AppSettingsContext'
import { CompanySettingsProvider } from '@/context/CompanySettingsContext'
import { AppRoutes } from '@/routes/AppRoutes'

export function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <SystemHealthProvider>
          <AuthProvider>
            <AppSettingsProvider>
              <CompanySettingsProvider>
                <AppRoutes />
              </CompanySettingsProvider>
            </AppSettingsProvider>
          </AuthProvider>
        </SystemHealthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
