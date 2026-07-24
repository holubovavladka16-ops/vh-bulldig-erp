import { supabase } from '@/lib/supabase'

export interface DashboardStats {
  activeWorkers: number
  activeOrders: number
  pendingReports: number
  submittedForms: number
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
