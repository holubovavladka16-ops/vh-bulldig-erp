export interface ProjectNotification {
  id: string
  project_id: string
  type: string
  missing_date: string | null
  message: string
  is_resolved: boolean
  resolved_at: string | null
  resolved_by: string | null
  target_user_id: string | null
  created_at: string
  order_name?: string
  order_location?: string
  target_user_name?: string
}

export interface ProjectNotificationFilters {
  projectId?: string
  missingDateFrom?: string
  missingDateTo?: string
  isResolved?: boolean
}

export interface RunDiaryMissingCheckResult {
  checked_projects: number
  notifications_created: number
  notifications_resolved: number
  markers_updated: number
}
