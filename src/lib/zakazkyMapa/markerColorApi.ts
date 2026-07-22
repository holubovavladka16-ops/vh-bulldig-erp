import { supabase } from '@/lib/supabase'
import {
  PROJECT_MARKER_MANUAL_COLOR_LABELS,
  PROJECT_MARKER_REVERT_AUTO_REASON,
} from '@/constants/zakazkyMapa'
import { insertMarkerColorHistory } from '@/lib/zakazkyMapa/markerColorHistory'
import { recalculateProjectMarkerColor } from '@/lib/zakazkyMapa/recalculateMarkerColor'
import type { ProjectMapMarker, ProjectMarkerColor } from '@/types/zakazkyMapa'

async function fetchMarker(projectId: string): Promise<ProjectMapMarker | null> {
  const { data, error } = await supabase
    .from('project_map_markers')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as ProjectMapMarker | null
}

/**
 * Ručně přepíše barvu špendlíku (dočasný override).
 * Automatický výpočet zůstává vypnutý, dokud uživatel nevrátí režim auto.
 */
export async function setManualMarkerColor(
  projectId: string,
  color: ProjectMarkerColor,
  reason: string,
  changedBy: string
): Promise<ProjectMapMarker> {
  const trimmedReason = reason.trim()
  if (!trimmedReason) {
    throw new Error('Důvod změny je povinný')
  }

  const marker = await fetchMarker(projectId)
  if (!marker) {
    throw new Error('Špendlík zakázky nenalezen')
  }

  const label = PROJECT_MARKER_MANUAL_COLOR_LABELS[color]

  const { data, error } = await supabase
    .from('project_map_markers')
    .update({
      marker_color: color,
      color_label: label,
      color_source: 'manual',
    })
    .eq('project_id', projectId)
    .select('*')
    .single()

  if (error) throw new Error(error.message)

  await insertMarkerColorHistory({
    projectId,
    oldColor: marker.marker_color,
    newColor: color,
    colorLabel: label,
    changeType: 'manual',
    reason: trimmedReason,
    changedBy,
  })

  return data as ProjectMapMarker
}

/**
 * Zruší ruční override a okamžitě přepočítá barvu podle deníku a termínů.
 */
export async function revertMarkerToAutomatic(
  projectId: string,
  changedBy: string
): Promise<ProjectMapMarker | null> {
  const marker = await fetchMarker(projectId)
  if (!marker) {
    throw new Error('Špendlík zakázky nenalezen')
  }

  const oldColor = marker.marker_color
  const oldLabel = marker.color_label

  const { error: unlockError } = await supabase
    .from('project_map_markers')
    .update({ color_source: 'auto' })
    .eq('project_id', projectId)

  if (unlockError) throw new Error(unlockError.message)

  const updated = await recalculateProjectMarkerColor(projectId, { recordHistory: false })
  if (!updated) {
    throw new Error('Přepočet barvy se nezdařil')
  }

  await insertMarkerColorHistory({
    projectId,
    oldColor,
    newColor: updated.marker_color,
    colorLabel: updated.color_label,
    changeType: 'manual',
    reason: PROJECT_MARKER_REVERT_AUTO_REASON,
    changedBy,
  })

  if (updated.marker_color === oldColor && updated.color_label === oldLabel) {
    return updated
  }

  return updated
}

export { fetchMarkerColorHistory, formatMarkerColorState } from '@/lib/zakazkyMapa/markerColorHistory'
