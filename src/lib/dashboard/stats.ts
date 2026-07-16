import { supabase } from '@/lib/supabase'
import { fetchActiveJobOrders } from '@/lib/orders/api'
import { fetchProfitOverview } from '@/lib/profit/api'

export interface DashboardStats {
  activeWorkers: number
  activeOrders: number
  pendingReports: number
  submittedForms: number
}

export interface Design6ProfitPoint {
  label: string
  profit: number
}

export interface Design6ActiveOrder {
  id: string
  name: string
  location: string
}

export interface Design6DashboardStats {
  activeOrders: number
  employeesToday: number
  pendingReports: number
  monthlyProfit: number
  profitTrend: Design6ProfitPoint[]
  activeOrdersList: Design6ActiveOrder[]
}

function localIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function todayIsoDate(): string {
  return localIsoDate(new Date())
}

function currentMonthRange(): { dateFrom: string; dateTo: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    dateFrom: localIsoDate(start),
    dateTo: localIsoDate(end),
  }
}

async function fetchProfitTrend(): Promise<Design6ProfitPoint[]> {
  const now = new Date()
  const monthRequests: Promise<Design6ProfitPoint>[] = []

  for (let offset = 5; offset >= 0; offset -= 1) {
    const start = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0)
    const label = start.toLocaleDateString('cs-CZ', { month: 'short' })
    const dateFrom = localIsoDate(start)
    const dateTo = localIsoDate(end)

    monthRequests.push(
      fetchProfitOverview({ dateFrom, dateTo }).then((rows) => ({
        label,
        profit: rows.reduce((sum, row) => sum + row.net_profit, 0),
      }))
    )
  }

  return Promise.all(monthRequests)
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const [workersRes, ordersRes, reportsRes, formsRes] = await Promise.all([
    supabase.from('workers').select('id', { count: 'exact', head: true }).eq('status', 'aktivni'),
    supabase.from('job_orders').select('id', { count: 'exact', head: true }).eq('status', 'aktivni'),
    supabase.from('worker_reports').select('id', { count: 'exact', head: true }).eq('status', 'cekajici'),
    supabase.from('worker_daily_forms').select('id', { count: 'exact', head: true }).eq('status', 'odeslany'),
  ])

  if (workersRes.error) throw new Error(workersRes.error.message)
  if (ordersRes.error) throw new Error(ordersRes.error.message)
  if (reportsRes.error) throw new Error(reportsRes.error.message)
  if (formsRes.error) throw new Error(formsRes.error.message)

  return {
    activeWorkers: workersRes.count ?? 0,
    activeOrders: ordersRes.count ?? 0,
    pendingReports: reportsRes.count ?? 0,
    submittedForms: formsRes.count ?? 0,
  }
}

export async function fetchDesign6DashboardStats(): Promise<Design6DashboardStats> {
  const { dateFrom, dateTo } = currentMonthRange()
  const today = todayIsoDate()

  const [ordersRes, attendanceRes, reportsRes, profitRows, profitTrend, activeOrdersList] =
    await Promise.all([
      supabase.from('job_orders').select('id', { count: 'exact', head: true }).eq('status', 'aktivni'),
      supabase
        .from('worker_attendance_records')
        .select('id', { count: 'exact', head: true })
        .eq('attendance_date', today),
      supabase.from('worker_reports').select('id', { count: 'exact', head: true }).eq('status', 'cekajici'),
      fetchProfitOverview({ dateFrom, dateTo }),
      fetchProfitTrend(),
      fetchActiveJobOrders(),
    ])

  if (ordersRes.error) throw new Error(ordersRes.error.message)
  if (attendanceRes.error) throw new Error(attendanceRes.error.message)
  if (reportsRes.error) throw new Error(reportsRes.error.message)

  const monthlyProfit = profitRows.reduce((sum, row) => sum + row.net_profit, 0)

  return {
    activeOrders: ordersRes.count ?? 0,
    employeesToday: attendanceRes.count ?? 0,
    pendingReports: reportsRes.count ?? 0,
    monthlyProfit,
    profitTrend,
    activeOrdersList: activeOrdersList.map((order) => ({
      id: order.id,
      name: order.name,
      location: order.location,
    })),
  }
}
