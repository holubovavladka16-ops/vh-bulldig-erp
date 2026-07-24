import { calculateRouteLengthMeters } from '@/lib/excavations/geometry'
import type { ExcavationPoint } from '@/types/excavations'

export function getDraftLengthLabel(points: ExcavationPoint[]): string {
  return calculateRouteLengthMeters(points).toLocaleString('cs-CZ', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  })
}
