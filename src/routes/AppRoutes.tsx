import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { LoginPage } from '@/pages/auth/LoginPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { ModulePlaceholderPage } from '@/pages/modules/ModulePlaceholderPage'
import { SettingsHubPage } from '@/pages/settings/SettingsHubPage'
import { CompanySettingsPage } from '@/pages/settings/CompanySettingsPage'
import { ProfileSettingsPage } from '@/pages/settings/ProfileSettingsPage'
import { PermissionsSettingsPage } from '@/pages/settings/PermissionsSettingsPage'
import { AppSettingsPage } from '@/pages/settings/AppSettingsPage'
import { AppAppearanceSettingsPage } from '@/pages/settings/AppAppearanceSettingsPage'
import { PdfWatermarkSettingsPage } from '@/pages/settings/PdfWatermarkSettingsPage'
import { WorkersListPage } from '@/pages/workers/WorkersListPage'
import { WorkerDetailPage } from '@/pages/workers/WorkerDetailPage'
import { WorkerDetailRedirect } from '@/pages/workers/WorkerDetailRedirect'
import { EmployeePortalPage } from '@/pages/portal/EmployeePortalPage'
import { AttendanceModulePage } from '@/pages/attendance/AttendanceModulePage'
import { ReportsModulePage } from '@/pages/reports/ReportsModulePage'
import { OrdersModulePage } from '@/pages/orders/OrdersModulePage'
import { OrderDetailPage } from '@/pages/orders/OrderDetailPage'
import { CostsModulePage } from '@/pages/ekonomika/CostsModulePage'
import { PhotosModulePage } from '@/pages/photos/PhotosModulePage'
import { PhotosMapModulePage } from '@/pages/photos/PhotosMapModulePage'
import { ExcavationsMapModulePage } from '@/pages/excavations/ExcavationsMapModulePage'
import { DiaryModulePage } from '@/pages/diary/DiaryModulePage'
import { ConnectionsModulePage } from '@/pages/pripojky/ConnectionsModulePage'
import { PayrollModulePage } from '@/pages/payroll/PayrollModulePage'
import { ReceiptsModulePage } from '@/pages/receipts/ReceiptsModulePage'
import { ContractsModulePage } from '@/pages/contracts/ContractsModulePage'
import { ProfitOverviewPage } from '@/pages/profit/ProfitOverviewPage'
import { DailyFormsModulePage } from '@/pages/dailyForms/DailyFormsModulePage'
import { PaperFormsModulePage } from '@/pages/paperForms/PaperFormsModulePage'
import { PaperFormDetailPage } from '@/pages/paperForms/PaperFormDetailPage'
import { FUTURE_MODULES } from '@/constants/modules'

const placeholderModules = FUTURE_MODULES.filter(
  (m) =>
    ![
      'nastaveni',
      'delnici',
      'dochazka',
      'vykazy',
      'papierove-vykazy',
      'vyplatni-pasky',
      'zakazky',
      'ekonomika',
      'fotky',
      'fotky-na-mape',
      'mapa-vykopu',
      'denik',
      'pripojky',
      'denni-formulare',
      'paragony',
      'dokumenty',
      'statistiky',
    ].includes(m.id)
)

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/prihlaseni" element={<LoginPage />} />
      <Route path="/zapomenute-heslo" element={<ForgotPasswordPage />} />
      <Route path="/obnova-hesla" element={<ResetPasswordPage />} />

      {/* Portál zaměstnance – veřejný, bez ERP přístupu */}
      <Route path="/portal/:token" element={<EmployeePortalPage />} />
      <Route path="/portal/:token/:tab" element={<EmployeePortalPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute requiredModule="dashboard">
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      {/* Modul 2 – Dělníci */}
      <Route
        path="/delnici"
        element={
          <ProtectedRoute requiredModule="delnici">
            <WorkersListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/delnici/:id/:tab"
        element={
          <ProtectedRoute requiredModule="delnici">
            <WorkerDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/delnici/:id"
        element={
          <ProtectedRoute requiredModule="delnici">
            <WorkerDetailRedirect />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dochazka"
        element={
          <ProtectedRoute requiredModule="dochazka">
            <AttendanceModulePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vykazy"
        element={
          <ProtectedRoute requiredModule="vykazy">
            <ReportsModulePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/vykazy/papierove"
        element={
          <ProtectedRoute requiredModule="papierove-vykazy">
            <PaperFormsModulePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vykazy/papierove/:id"
        element={
          <ProtectedRoute requiredModule="papierove-vykazy">
            <PaperFormDetailPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/zakazky"
        element={
          <ProtectedRoute requiredModule="zakazky">
            <OrdersModulePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/zakazky/:id"
        element={
          <ProtectedRoute requiredModule="zakazky">
            <OrderDetailPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/ekonomika"
        element={
          <ProtectedRoute requiredModule="ekonomika">
            <CostsModulePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/fotky"
        element={
          <ProtectedRoute requiredModule="fotky">
            <PhotosModulePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/fotky-na-mape"
        element={
          <ProtectedRoute requiredModule="fotky-na-mape">
            <PhotosMapModulePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/mapa-vykopu"
        element={
          <ProtectedRoute requiredModule="mapa-vykopu">
            <ExcavationsMapModulePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/denik"
        element={
          <ProtectedRoute requiredModule="denik">
            <DiaryModulePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/vyplatni-pasky"
        element={
          <ProtectedRoute requiredModule="vyplatni-pasky">
            <PayrollModulePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/pripojky"
        element={
          <ProtectedRoute requiredModule="pripojky">
            <ConnectionsModulePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/paragony"
        element={
          <ProtectedRoute requiredModule="paragony">
            <ReceiptsModulePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dokumenty"
        element={
          <ProtectedRoute requiredModule="dokumenty">
            <ContractsModulePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/denni-formulare"
        element={
          <ProtectedRoute requiredModule="denni-formulare">
            <DailyFormsModulePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/statistiky"
        element={
          <ProtectedRoute requiredModule="statistiky">
            <ProfitOverviewPage />
          </ProtectedRoute>
        }
      />

      {placeholderModules.map((module) => (
        <Route
          key={module.id}
          path={module.path}
          element={
            <ProtectedRoute requiredModule={module.module}>
              <ModulePlaceholderPage moduleId={module.id} />
            </ProtectedRoute>
          }
        />
      ))}

      <Route
        path="/nastaveni"
        element={
          <ProtectedRoute requiredModule="nastaveni">
            <SettingsHubPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/nastaveni/spolecnost"
        element={
          <ProtectedRoute requiredModule="nastaveni-spolecnost">
            <CompanySettingsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/nastaveni/profil"
        element={
          <ProtectedRoute requiredModule="nastaveni-profil">
            <ProfileSettingsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/nastaveni/opravneni"
        element={
          <ProtectedRoute requiredModule="nastaveni-opravneni">
            <PermissionsSettingsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/nastaveni/aplikace"
        element={
          <ProtectedRoute requiredModule="nastaveni-aplikace">
            <AppSettingsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/nastaveni/vzhled"
        element={
          <ProtectedRoute requiredModule="nastaveni-vzhled">
            <AppAppearanceSettingsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/nastaveni/vodoznak-pdf"
        element={
          <ProtectedRoute requiredModule="nastaveni-vodoznak-pdf">
            <PdfWatermarkSettingsPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/prihlaseni" replace />} />
    </Routes>
  )
}
