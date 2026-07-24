import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Star, Trash2, UserCog } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { DataTable, DataTableCell, DataTableRow } from '@/components/ui/DataTable'
import { formatDate } from '@/constants/workers'
import {
  createProjectAssignment,
  fetchProjectAssignments,
  fetchStavbyvedouciProfiles,
  removeProjectAssignment,
  updateProjectAssignment,
} from '@/lib/zakazkyMapa/projectAssignmentsApi'
import type { ProjectUserAssignment, StavbyvedouciProfileOption } from '@/types/projectAssignments'

interface ProjectStavbyvedouciSectionProps {
  projectId: string
  userId: string
}

function displayName(assignment: ProjectUserAssignment): string {
  return assignment.user_name?.trim() || assignment.user_email || assignment.user_id
}

import { isActiveProjectAssignment } from '@/lib/zakazkyMapa/projectAssignmentRules'

export function ProjectStavbyvedouciSection({ projectId, userId }: ProjectStavbyvedouciSectionProps) {
  const [assignments, setAssignments] = useState<ProjectUserAssignment[]>([])
  const [profiles, setProfiles] = useState<StavbyvedouciProfileOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10))
  const [validTo, setValidTo] = useState('')
  const [asPrimary, setAsPrimary] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editFrom, setEditFrom] = useState('')
  const [editTo, setEditTo] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [rows, options] = await Promise.all([
        fetchProjectAssignments(projectId),
        fetchStavbyvedouciProfiles(),
      ])
      setAssignments(rows)
      setProfiles(options.filter((profile) => profile.is_active))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Načtení přiřazení se nezdařilo')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  const primaryAssignment = useMemo(
    () => assignments.find((row) => row.is_primary && isActiveProjectAssignment(row)) ?? null,
    [assignments]
  )

  const profileOptions = useMemo(
    () =>
      profiles.map((profile) => ({
        value: profile.id,
        label: profile.full_name?.trim() || profile.email,
      })),
    [profiles]
  )

  async function handleCreate() {
    if (!selectedUserId) {
      setError('Vyberte Stavbyvedoucího')
      return
    }
    setSaving(true)
    setError('')
    try {
      await createProjectAssignment({
        projectId,
        userId: selectedUserId,
        isPrimary: asPrimary,
        validFrom,
        validTo: validTo.trim() || null,
        assignedBy: userId,
      })
      setShowForm(false)
      setSelectedUserId('')
      setValidTo('')
      setAsPrimary(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Přidání se nezdařilo')
    } finally {
      setSaving(false)
    }
  }

  async function handleSetPrimary(assignmentId: string) {
    setSaving(true)
    setError('')
    try {
      await updateProjectAssignment({
        assignmentId,
        projectId,
        isPrimary: true,
        changedBy: userId,
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nastavení hlavního se nezdařilo')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(assignment: ProjectUserAssignment) {
    setSaving(true)
    setError('')
    try {
      await updateProjectAssignment({
        assignmentId: assignment.id,
        projectId,
        isActive: !assignment.is_active,
        changedBy: userId,
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Změna stavu se nezdařila')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveValidity(assignmentId: string) {
    setSaving(true)
    setError('')
    try {
      await updateProjectAssignment({
        assignmentId,
        projectId,
        validFrom: editFrom,
        validTo: editTo.trim() || null,
        changedBy: userId,
      })
      setEditId(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Úprava platnosti se nezdařila')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(assignmentId: string) {
    if (!window.confirm('Odebrat toto přiřazení Stavbyvedoucího?')) return
    setSaving(true)
    setError('')
    try {
      await removeProjectAssignment(assignmentId, projectId, userId)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Odebrání se nezdařilo')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-theme-primary">
            <UserCog className="h-5 w-5" aria-hidden="true" />
            Stavbyvedoucí
          </h3>
          <p className="mt-1 text-sm text-theme-muted">
            Hlavní:{' '}
            <strong className="text-theme-primary">
              {primaryAssignment ? displayName(primaryAssignment) : 'není přiřazen'}
            </strong>
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm((open) => !open)} disabled={saving}>
          <Plus className="h-4 w-4" />
          Přidat Stavbyvedoucího
        </Button>
      </div>

      {showForm ? (
        <div className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 md:grid-cols-2">
          <Select
            label="Stavbyvedoucí"
            options={[{ value: '', label: 'Vyberte uživatele…' }, ...profileOptions]}
            value={selectedUserId}
            onChange={(event) => setSelectedUserId(event.target.value)}
          />
          <Input
            label="Platnost od"
            type="date"
            value={validFrom}
            onChange={(event) => setValidFrom(event.target.value)}
          />
          <Input
            label="Platnost do"
            type="date"
            value={validTo}
            onChange={(event) => setValidTo(event.target.value)}
          />
          <label className="flex items-center gap-2 text-sm text-theme-primary md:col-span-2">
            <input
              type="checkbox"
              checked={asPrimary}
              onChange={(event) => setAsPrimary(event.target.checked)}
            />
            Nastavit jako hlavního Stavbyvedoucího
          </label>
          <div className="flex gap-2 md:col-span-2">
            <Button onClick={() => void handleCreate()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Uložit přiřazení
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)} disabled={saving}>
              Zrušit
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <DataTable
        columns={[
          { key: 'name', label: 'Uživatel' },
          { key: 'primary', label: 'Role' },
          { key: 'validity', label: 'Platnost' },
          { key: 'status', label: 'Stav' },
          { key: 'actions', label: 'Akce' },
        ]}
        isEmpty={assignments.length === 0}
        emptyMessage="K zakázce zatím není přiřazen žádný Stavbyvedoucí."
      >
        {assignments.map((assignment) => (
          <DataTableRow key={assignment.id}>
            <DataTableCell>{displayName(assignment)}</DataTableCell>
            <DataTableCell>
              {assignment.is_primary ? (
                <span className="inline-flex items-center gap-1 text-amber-300">
                  <Star className="h-4 w-4" />
                  Hlavní
                </span>
              ) : (
                'Další'
              )}
            </DataTableCell>
            <DataTableCell>
              {editId === assignment.id ? (
                <div className="flex flex-wrap items-end gap-2">
                  <Input
                    label="Od"
                    type="date"
                    value={editFrom}
                    onChange={(event) => setEditFrom(event.target.value)}
                  />
                  <Input
                    label="Do"
                    type="date"
                    value={editTo}
                    onChange={(event) => setEditTo(event.target.value)}
                  />
                  <Button size="sm" disabled={saving} onClick={() => void handleSaveValidity(assignment.id)}>
                    Uložit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>
                    Zrušit
                  </Button>
                </div>
              ) : (
                <>
                  {formatDate(assignment.valid_from)} –{' '}
                  {assignment.valid_to ? formatDate(assignment.valid_to) : 'neomezeně'}
                </>
              )}
            </DataTableCell>
            <DataTableCell>
              {isActiveProjectAssignment(assignment) ? 'Aktivní' : 'Neaktivní / mimo platnost'}
            </DataTableCell>
            <DataTableCell>
              <div className="flex flex-wrap gap-2">
                {!assignment.is_primary ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={saving}
                    onClick={() => void handleSetPrimary(assignment.id)}
                  >
                    Nastavit jako hlavního
                  </Button>
                ) : null}
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={saving}
                  onClick={() => {
                    setEditId(assignment.id)
                    setEditFrom(assignment.valid_from)
                    setEditTo(assignment.valid_to ?? '')
                  }}
                >
                  Upravit platnost
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={saving}
                  onClick={() => void handleToggleActive(assignment)}
                >
                  {assignment.is_active ? 'Deaktivovat' : 'Aktivovat'}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={saving}
                  onClick={() => void handleRemove(assignment.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  Odebrat
                </Button>
              </div>
            </DataTableCell>
          </DataTableRow>
        ))}
      </DataTable>
    </div>
  )
}
