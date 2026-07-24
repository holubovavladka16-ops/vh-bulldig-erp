import { supabase } from '@/lib/supabase'
import type {
  ProjectMarkerChangeType,
  ProjectMarkerColor,
  ProjectMarkerStatusHistory,
} from '@/types/zakazkyMapa'

type HistoryRow = ProjectMarkerStatusHistory & {
  changer?: { full_name: string | null; email: string | null } | null
}

export interface InsertMarkerColorHistoryInput {
  projectId: string
  oldColor: ProjectMarkerColor | null
  newColor: ProjectMarkerColor
  colorLabel: string
  changeType: ProjectMarkerChangeType
  reason?: string | null
  changedBy?: string | null
  missingDate?: string | null
}

function mapHistoryRow(row: HistoryRow): ProjectMarkerStatusHistory {
  return {
    id: row.id,
    project_id: row.project_id,
    old_color: row.old_color,
    new_color: row.new_color,
    color_label: row.color_label,
    change_type: row.change_type,
    missing_date: row.missing_date,
    reason: row.reason,
    valid_from: row.valid_from,
    valid_to: row.valid_to,
    changed_by: row.changed_by,
    changed_by_name:
      row.changer?.full_name?.trim() || row.changer?.email?.trim() || undefined,
    created_at: row.created_at,
  }
}

export async function insertMarkerColorHistory(
  input: InsertMarkerColorHistoryInput
): Promise<void> {
  const { error } = await supabase.from('project_marker_status_history').insert({
    project_id: input.projectId,
    old_color: input.oldColor,
    new_color: input.newColor,
    color_label: input.colorLabel,
    change_type: input.changeType,
    reason: input.reason?.trim() || null,
    changed_by: input.changedBy ?? null,
    missing_date: input.missingDate ?? null,
  })

  if (error) {
    console.error('[zakazky-mapa] Zápis historie barvy selhal:', error.message)
  }
}

export async function fetchMarkerColorHistory(
  projectId: string
): Promise<ProjectMarkerStatusHistory[]> {
  const { data, error } = await supabase
    .from('project_marker_status_history')
    .select(
      '*, changer:profiles!project_marker_status_history_changed_by_fkey(full_name, email)'
    )
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return ((data ?? []) as HistoryRow[]).map(mapHistoryRow)
}

export function formatMarkerColorState(
  color: ProjectMarkerColor | null,
  label: string | null | undefined
): string {
  if (!color) return '—'
  return label?.trim() ? label : color
}
