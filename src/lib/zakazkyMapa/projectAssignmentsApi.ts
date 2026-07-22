import { supabase } from '@/lib/supabase'
import type {
  ProjectAssignmentInput,
  ProjectAssignmentUpdateInput,
  ProjectUserAssignment,
  ProjectUserAssignmentHistory,
  StavbyvedouciProfileOption,
} from '@/types/projectAssignments'

type AssignmentRow = ProjectUserAssignment & {
  user?: { full_name: string | null; email: string | null } | null
}

type HistoryRow = ProjectUserAssignmentHistory & {
  changer?: { full_name: string | null; email: string | null } | null
  user?: { full_name: string | null; email: string | null } | null
}

function mapAssignment(row: AssignmentRow): ProjectUserAssignment {
  return {
    ...row,
    user_name: row.user?.full_name?.trim() || undefined,
    user_email: row.user?.email?.trim() || undefined,
  }
}

function mapHistoryRow(row: HistoryRow): ProjectUserAssignmentHistory {
  return {
    ...row,
    changed_by_name: row.changer?.full_name?.trim() || row.changer?.email?.trim() || undefined,
    user_name: row.user?.full_name?.trim() || row.user?.email?.trim() || undefined,
  }
}

async function assertStavbyvedouciUser(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data || (data as { role: string }).role !== 'stavbyvedouci') {
    throw new Error('Přiřadit lze pouze uživatele s rolí Stavbyvedoucí')
  }
}

async function writeAssignmentAudit(
  input: Omit<ProjectUserAssignmentHistory, 'id' | 'created_at' | 'changed_by_name' | 'user_name'>
): Promise<void> {
  const { error } = await supabase.from('project_user_assignment_history').insert(input)
  if (error) throw new Error(error.message)
}

export async function fetchStavbyvedouciProfiles(): Promise<StavbyvedouciProfileOption[]> {
  const { data, error } = await supabase.rpc('list_stavbyvedouci_profiles')
  if (error) throw new Error(error.message)
  return (data ?? []) as StavbyvedouciProfileOption[]
}

export async function fetchProjectAssignments(projectId: string): Promise<ProjectUserAssignment[]> {
  const { data, error } = await supabase
    .from('project_user_assignments')
    .select('*, user:profiles!project_user_assignments_user_id_fkey(full_name, email)')
    .eq('project_id', projectId)
    .order('is_primary', { ascending: false })
    .order('valid_from', { ascending: false })

  if (error) throw new Error(error.message)
  return ((data ?? []) as AssignmentRow[]).map(mapAssignment)
}

export async function fetchProjectAssignmentHistory(
  projectId: string
): Promise<ProjectUserAssignmentHistory[]> {
  const { data, error } = await supabase
    .from('project_user_assignment_history')
    .select(
      '*, changer:profiles!project_user_assignment_history_changed_by_fkey(full_name, email), user:profiles!project_user_assignment_history_user_id_fkey(full_name, email)'
    )
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return ((data ?? []) as HistoryRow[]).map(mapHistoryRow)
}

export async function checkActiveProjectAssignment(projectId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_active_project_assignment', {
    p_project_id: projectId,
  })
  if (error) throw new Error(error.message)
  return Boolean(data)
}

export async function createProjectAssignment(input: ProjectAssignmentInput): Promise<ProjectUserAssignment> {
  if (input.projectId.trim() !== input.projectId) {
    throw new Error('Neplatné ID zakázky')
  }

  await assertStavbyvedouciUser(input.userId)

  const payload = {
    project_id: input.projectId,
    user_id: input.userId,
    is_primary: input.isPrimary ?? false,
    valid_from: input.validFrom,
    valid_to: input.validTo ?? null,
    is_active: true,
    assigned_by: input.assignedBy,
  }

  const { data, error } = await supabase
    .from('project_user_assignments')
    .insert(payload)
    .select('*, user:profiles!project_user_assignments_user_id_fkey(full_name, email)')
    .single()

  if (error) throw new Error(error.message)

  const assignment = mapAssignment(data as AssignmentRow)

  await writeAssignmentAudit({
    assignment_id: assignment.id,
    project_id: assignment.project_id,
    user_id: assignment.user_id,
    action: 'created',
    is_primary: assignment.is_primary,
    valid_from: assignment.valid_from,
    valid_to: assignment.valid_to,
    is_active: assignment.is_active,
    changed_by: input.assignedBy,
  })

  return assignment
}

export async function updateProjectAssignment(
  input: ProjectAssignmentUpdateInput
): Promise<ProjectUserAssignment> {
  const { data: existing, error: fetchError } = await supabase
    .from('project_user_assignments')
    .select('*')
    .eq('id', input.assignmentId)
    .maybeSingle()

  if (fetchError) throw new Error(fetchError.message)
  if (!existing) throw new Error('Přiřazení nenalezeno')

  const row = existing as ProjectUserAssignment
  if (row.project_id !== input.projectId) {
    throw new Error('Přiřazení nepatří k této zakázce')
  }

  const patch: Record<string, unknown> = {}
  if (input.isPrimary != null) patch.is_primary = input.isPrimary
  if (input.validFrom != null) patch.valid_from = input.validFrom
  if (input.validTo !== undefined) patch.valid_to = input.validTo
  if (input.isActive != null) patch.is_active = input.isActive

  const { data, error } = await supabase
    .from('project_user_assignments')
    .update(patch)
    .eq('id', input.assignmentId)
    .eq('project_id', input.projectId)
    .select('*, user:profiles!project_user_assignments_user_id_fkey(full_name, email)')
    .single()

  if (error) throw new Error(error.message)

  const assignment = mapAssignment(data as AssignmentRow)
  const action =
    input.isActive === false
      ? 'deactivated'
      : input.isActive === true && row.is_active === false
        ? 'reactivated'
        : input.isPrimary
          ? 'set_primary'
          : 'updated'

  await writeAssignmentAudit({
    assignment_id: assignment.id,
    project_id: assignment.project_id,
    user_id: assignment.user_id,
    action,
    is_primary: assignment.is_primary,
    valid_from: assignment.valid_from,
    valid_to: assignment.valid_to,
    is_active: assignment.is_active,
    changed_by: input.changedBy,
  })

  return assignment
}

export async function removeProjectAssignment(
  assignmentId: string,
  projectId: string,
  changedBy: string
): Promise<void> {
  const { data: existing, error: fetchError } = await supabase
    .from('project_user_assignments')
    .select('*')
    .eq('id', assignmentId)
    .maybeSingle()

  if (fetchError) throw new Error(fetchError.message)
  if (!existing) throw new Error('Přiřazení nenalezeno')

  const row = existing as ProjectUserAssignment
  if (row.project_id !== projectId) {
    throw new Error('Přiřazení nepatří k této zakázce')
  }

  const { error } = await supabase
    .from('project_user_assignments')
    .delete()
    .eq('id', assignmentId)
    .eq('project_id', projectId)

  if (error) throw new Error(error.message)

  await writeAssignmentAudit({
    assignment_id: assignmentId,
    project_id: projectId,
    user_id: row.user_id,
    action: 'removed',
    is_primary: row.is_primary,
    valid_from: row.valid_from,
    valid_to: row.valid_to,
    is_active: false,
    changed_by: changedBy,
  })
}
