import { useState } from 'react'
import { Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import {
  PROJECT_MARKER_CHANGE_TYPE_LABELS,
  PROJECT_MARKER_MANUAL_COLOR_OPTIONS,
  PROJECT_MARKER_REVERT_AUTO_REASON,
} from '@/constants/zakazkyMapa'
import {
  revertMarkerToAutomatic,
  setManualMarkerColor,
} from '@/lib/zakazkyMapa/markerColorApi'
import type { ProjectMapMarkerWithOrder, ProjectMarkerColor } from '@/types/zakazkyMapa'

interface ProjectMarkerColorOverrideProps {
  item: ProjectMapMarkerWithOrder
  userId: string
  onChanged: (projectId: string) => Promise<void>
}

export function ProjectMarkerColorOverride({
  item,
  userId,
  onChanged,
}: ProjectMarkerColorOverrideProps) {
  const [expanded, setExpanded] = useState(false)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isManual = item.color_source === 'manual'

  async function handleSelectColor(color: ProjectMarkerColor) {
    setError('')
    setLoading(true)
    try {
      await setManualMarkerColor(item.project_id, color, reason, userId)
      setReason('')
      setExpanded(false)
      await onChanged(item.project_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Změna stavu se nezdařila')
    } finally {
      setLoading(false)
    }
  }

  async function handleRevert() {
    setError('')
    setLoading(true)
    try {
      await revertMarkerToAutomatic(item.project_id, userId)
      setExpanded(false)
      await onChanged(item.project_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vrácení na automatiku se nezdařilo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="space-y-3 border-t border-white/10 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-theme-primary">Stav špendlíku</h4>
          <p className="mt-1 text-xs text-theme-muted">
            Zdroj:{' '}
            <strong className="text-theme-primary">
              {PROJECT_MARKER_CHANGE_TYPE_LABELS[item.color_source]}
            </strong>
          </p>
        </div>
        {!expanded ? (
          <Button variant="secondary" size="sm" onClick={() => setExpanded(true)}>
            Přepsat stav
          </Button>
        ) : null}
      </div>

      {expanded ? (
        <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <Textarea
            label="Důvod změny"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Popište důvod ručního přepsání stavu…"
            rows={2}
            required
          />

          <div className="grid gap-2 sm:grid-cols-2">
            {PROJECT_MARKER_MANUAL_COLOR_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant="secondary"
                className="justify-start"
                disabled={loading || !reason.trim()}
                onClick={() => void handleSelectColor(option.value)}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span aria-hidden="true">{option.emoji}</span>
                )}
                {option.label}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" disabled={loading} onClick={() => setExpanded(false)}>
              Zrušit
            </Button>
          </div>
        </div>
      ) : null}

      {isManual ? (
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          disabled={loading}
          onClick={() => void handleRevert()}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          Vrátit na automatický výpočet
        </Button>
      ) : null}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {isManual ? (
        <p className="text-xs text-theme-muted">
          Ruční stav je dočasný override. Automatický výpočet se obnoví tlačítkem výše (
          {PROJECT_MARKER_REVERT_AUTO_REASON.toLowerCase()}).
        </p>
      ) : null}
    </section>
  )
}
