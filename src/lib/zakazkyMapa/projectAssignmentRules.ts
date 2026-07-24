import type { ProjectUserAssignment } from '@/types/projectAssignments'

/** Platné aktivní přiřazení dle pravidel RLS (is_assigned_to_project). */
export function isActiveProjectAssignment(
  assignment: Pick<ProjectUserAssignment, 'is_active' | 'valid_from' | 'valid_to'>,
  today = new Date().toISOString().slice(0, 10)
): boolean {
  if (!assignment.is_active) return false
  if (assignment.valid_from > today) return false
  if (assignment.valid_to && assignment.valid_to < today) return false
  return true
}

/** Vrátí nejvýše jednoho aktivního hlavního Stavbyvedoucího. */
export function findActivePrimaryAssignment(
  assignments: ProjectUserAssignment[],
  today = new Date().toISOString().slice(0, 10)
): ProjectUserAssignment | null {
  const primaries = assignments.filter(
    (row) => row.is_primary && isActiveProjectAssignment(row, today)
  )
  return primaries[0] ?? null
}

export function countActivePrimaryAssignments(
  assignments: ProjectUserAssignment[],
  today = new Date().toISOString().slice(0, 10)
): number {
  return assignments.filter((row) => row.is_primary && isActiveProjectAssignment(row, today)).length
}
