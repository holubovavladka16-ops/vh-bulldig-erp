import { supabase } from '@/lib/supabase'
import { PROJECT_NOTIFICATION_TYPE_MISSING_DIARY } from '@/constants/projectNotifications'
import type {
  ProjectNotification,
  ProjectNotificationFilters,
  RunDiaryMissingCheckResult,
} from '@/types/projectNotifications'

type NotificationRow = ProjectNotification & {
  job_orders: { name: string; location: string } | null
  target: { full_name: string | null; email: string | null } | null
}

function mapNotificationRow(row: NotificationRow): ProjectNotification {
  return {
    id: row.id,
    project_id: row.project_id,
    type: row.type,
    missing_date: row.missing_date,
    message: row.message,
    is_resolved: row.is_resolved,
    resolved_at: row.resolved_at,
    resolved_by: row.resolved_by,
    target_user_id: row.target_user_id,
    created_at: row.created_at,
    order_name: row.job_orders?.name,
    order_location: row.job_orders?.location,
    target_user_name:
      row.target?.full_name?.trim() || row.target?.email?.trim() || undefined,
  }
}

const NOTIFICATION_SELECT =
  '*, job_orders(name, location), target:profiles!project_notifications_target_user_id_fkey(full_name, email)'

export async function fetchProjectNotifications(
  filters: ProjectNotificationFilters = {}
): Promise<ProjectNotification[]> {
  let query = supabase
    .from('project_notifications')
    .select(NOTIFICATION_SELECT)
    .eq('type', PROJECT_NOTIFICATION_TYPE_MISSING_DIARY)
    .order('created_at', { ascending: false })

  if (filters.projectId) query = query.eq('project_id', filters.projectId)
  if (filters.missingDateFrom) query = query.gte('missing_date', filters.missingDateFrom)
  if (filters.missingDateTo) query = query.lte('missing_date', filters.missingDateTo)
  if (filters.isResolved === true) query = query.eq('is_resolved', true)
  if (filters.isResolved === false) query = query.eq('is_resolved', false)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data ?? []) as NotificationRow[]).map(mapNotificationRow)
}

export async function countUnresolvedProjectNotifications(): Promise<number> {
  const { count, error } = await supabase
    .from('project_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('type', PROJECT_NOTIFICATION_TYPE_MISSING_DIARY)
    .eq('is_resolved', false)

  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function runMissingDiaryCheck(): Promise<RunDiaryMissingCheckResult> {
  const { data, error } = await supabase.rpc('run_missing_diary_check')
  if (error) throw new Error(error.message)
  return (data ?? {
    checked_projects: 0,
    notifications_created: 0,
    notifications_resolved: 0,
    markers_updated: 0,
  }) as RunDiaryMissingCheckResult
}

export async function resolveMissingDiaryNotificationsForEntry(
  projectId: string,
  entryDate: string,
  resolvedBy: string
): Promise<void> {
  const { error } = await supabase.rpc('resolve_missing_diary_notifications', {
    p_project_id: projectId,
    p_missing_date: entryDate,
    p_resolved_by: resolvedBy,
  })
  if (error) throw new Error(error.message)
}
