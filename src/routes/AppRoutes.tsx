import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { RouteLoader } from '@/components/ui/RouteLoader'
import { FUTURE_MODULES } from '@/constants/modules'

const LoginPage = lazy(() =>
  import('@/pages/auth/LoginPage').then((m) => ({ default: m.LoginPage }))
)
const ForgotPasswordPage = lazy(() =>
  import('@/pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage }))
)
const ResetPasswordPage = lazy(() =>
  import('@/pages/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage }))
)
const DashboardPage = lazy(() =>
  import('@/pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage }))
)
const ModulePlaceholderPage = lazy(() =>
  import('@/pages/modules/ModulePlaceholderPage').then((m) => ({ default: m.ModulePlaceholderPage }))
)
const SettingsHubPage = lazy(() =>
  import('@/pages/settings/SettingsHubPage').then((m) => ({ default: m.SettingsHubPage }))
)
const CompanySettingsPage = lazy(() =>
  import('@/pages/settings/CompanySettingsPage').then((m) => ({ default: m.CompanySettingsPage }))
)
const ProfileSettingsPage = lazy(() =>
  import('@/pages/settings/ProfileSettingsPage').then((m) => ({ default: m.ProfileSettingsPage }))
)
const PermissionsSettingsPage = lazy(() =>
  import('@/pages/settings/PermissionsSettingsPage').then((m) => ({ default: m.PermissionsSettingsPage }))
)
const AppSettingsPage = lazy(() =>
  import('@/pages/settings/AppSettingsPage').then((m) => ({ default: m.AppSettingsPage }))
)
const WorkersListPage = lazy(() =>
  import('@/pages/workers/WorkersListPage').then((m) => ({ default: m.WorkersListPage }))
)
const WorkerDetailPage = lazy(() =>
  import('@/pages/workers/WorkerDetailPage').then((m) => ({ default: m.WorkerDetailPage }))
)
const WorkerDetailRedirect = lazy(() =>
  import('@/pages/workers/WorkerDetailRedirect').then((m) => ({ default: m.WorkerDetailRedirect }))
)
const EmployeePortalPage = lazy(() =>
  import('@/pages/portal/EmployeePortalPage').then((m) => ({ default: m.EmployeePortalPage }))
)
const AttendanceModulePage = lazy(() =>
  import('@/pages/attendance/AttendanceModulePage').then((m) => ({ default: m.AttendanceModulePage }))
)
const ReportsModulePage = lazy(() =>
  import('@/pages/reports/ReportsModulePage').then((m) => ({ default: m.ReportsModulePage }))
)
const OrdersModulePage = lazy(() =>
  import('@/pages/orders/OrdersModulePage').then((m) => ({ default: m.OrdersModulePage }))
)
const OrderDetailPage = lazy(() =>
  import('@/pages/orders/OrderDetailPage').then((m) => ({ default: m.OrderDetailPage }))
)
const CostsModulePage = lazy(() =>
  import('@/pages/ekonomika/CostsModulePage').then((m) => ({ default: m.CostsModulePage }))
)
const PhotosModulePage = lazy(() =>
  import('@/pages/photos/PhotosModulePage').then((m) => ({ default: m.PhotosModulePage }))
)
const PhotosMapModulePage = lazy(() =>
  import('@/pages/photos/PhotosMapModulePage').then((m) => ({ default: m.PhotosMapModulePage }))
)
const ExcavationsMapModulePage = lazy(() =>
  import('@/pages/excavations/ExcavationsMapModulePage').then((m) => ({
    default: m.ExcavationsMapModulePage,
  }))
)
const DiaryModulePage = lazy(() =>
  import('@/pages/diary/DiaryModulePage').then((m) => ({ default: m.DiaryModulePage }))
)
const ConnectionsModulePage = lazy(() =>
  import('@/pages/pripojky/ConnectionsModulePage').then((m) => ({ default: m.ConnectionsModulePage }))
)
const PayrollModulePage = lazy(() =>
  import('@/pages/payroll/PayrollModulePage').then((m) => ({ default: m.PayrollModulePage }))
)
const ReceiptsModulePage = lazy(() =>
  import('@/pages/receipts/ReceiptsModulePage').then((m) => ({ default: m.ReceiptsModulePage }))
)
const ContractsModulePage = lazy(() =>
  import('@/pages/contracts/ContractsModulePage').then((m) => ({ default: m.ContractsModulePage }))
)
const ProfitOverviewPage = lazy(() =>
  import('@/pages/profit/ProfitOverviewPage').then((m) => ({ default: m.ProfitOverviewPage }))
)
const DailyFormsModulePage = lazy(() =>
  import('@/pages/dailyForms/DailyFormsModulePage').then((m) => ({ default: m.DailyFormsModulePage }))
)
const PaperFormsModulePage = lazy(() =>
  import('@/pages/paperForms/PaperFormsModulePage').then((m) => ({ default: m.PaperFormsModulePage }))
)
const PaperFormDetailPage = lazy(() =>
  import('@/pages/paperForms/PaperFormDetailPage').then((m) => ({ default: m.PaperFormDetailPage }))
)
const FormCheckModulePage = lazy(() =>
  import('@/pages/formCheck/FormCheckModulePage').then((m) => ({ default: m.FormCheckModulePage }))
)
const FormCheckHistoryPage = lazy(() =>
  import('@/pages/formCheck/FormCheckHistoryPage').then((m) => ({ default: m.FormCheckHistoryPage }))
)
const FormCheckDetailPage = lazy(() =>
  import('@/pages/formCheck/FormCheckDetailPage').then((m) => ({ default: m.FormCheckDetailPage }))
)

const placeholderModules = FUTURE_MODULES.filter(
  (m) =>
    ![
      'nastaveni',
      'delnici',
      'dochazka',
      'vykazy',
      'papierove-vykazy',
      'kontrola-formulare',
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
    <Suspense fallback={<RouteLoader />}>
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
          path="/kontrola-formulare"
          element={
            <ProtectedRoute requiredModule="kontrola-formulare">
              <FormCheckModulePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/kontrola-formulare/historie"
          element={
            <ProtectedRoute requiredModule="kontrola-formulare">
              <FormCheckHistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/kontrola-formulare/historie/:id"
          element={
            <ProtectedRoute requiredModule="kontrola-formulare">
              <FormCheckDetailPage />
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

        <Route path="*" element={<Navigate to="/prihlaseni" replace />} />
      </Routes>
    </Suspense>
  )
}
