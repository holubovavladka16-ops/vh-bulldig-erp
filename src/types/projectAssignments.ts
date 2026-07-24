export type ProjectAssignmentAction =
  | 'created'
  | 'updated'
  | 'deactivated'
  | 'removed'
  | 'set_primary'
  | 'reactivated'

export interface ProjectUserAssignment {
  id: string
  project_id: string
  user_id: string
  is_primary: boolean
  valid_from: string
  valid_to: string | null
  is_active: boolean
  assigned_by: string | null
  created_at: string
  user_name?: string
  user_email?: string
}

export interface ProjectUserAssignmentHistory {
  id: string
  assignment_id: string | null
  project_id: string
  user_id: string
  action: ProjectAssignmentAction
  is_primary: boolean | null
  valid_from: string | null
  valid_to: string | null
  is_active: boolean | null
  changed_by: string | null
  changed_by_name?: string
  user_name?: string
  created_at: string
}

export interface StavbyvedouciProfileOption {
  id: string
  email: string
  full_name: string
  is_active: boolean
}

export interface ProjectAssignmentInput {
  projectId: string
  userId: string
  isPrimary?: boolean
  validFrom: string
  validTo?: string | null
  assignedBy: string
}

export interface ProjectAssignmentUpdateInput {
  assignmentId: string
  projectId: string
  isPrimary?: boolean
  validFrom?: string
  validTo?: string | null
  isActive?: boolean
  changedBy: string
}
