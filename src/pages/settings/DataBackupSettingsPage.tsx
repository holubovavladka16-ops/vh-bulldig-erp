import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Database, Download, FileSpreadsheet, Trash2 } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  PRESERVED_ENTITY_LABELS,
  PRESERVED_ENTITIES,
  TEST_DATA_CONFIRM_PHRASE,
} from '@/constants/dataBackup'
import {
  auditDataBackup,
  deleteTestData,
  exportAllDataExcel,
  exportDatabaseJson,
  type CleanupResult,
  type DataBackupAudit,
} from '@/lib/settings/dataBackup'

export function DataBackupSettingsPage() {
  const [audit, setAudit] = useState<DataBackupAudit | null>(null)
  const [auditLoading, setAuditLoading] = useState(true)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [exportingDb, setExportingDb] = useState(false)
  const [confirmPhrase, setConfirmPhrase] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null)
  const [error, setError] = useState('')

  const loadAudit = useCallback(async () => {
    setAuditLoading(true)
    setError('')
    try {
      setAudit(await auditDataBackup())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Načtení přehledu dat se nezdařilo')
      setAudit(null)
    } finally {
      setAuditLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAudit()
  }, [loadAudit])

  const handleExportExcel = async () => {
    setExportingExcel(true)
    setError('')
    try {
      await exportAllDataExcel()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export do Excelu se nezdařil')
    } finally {
      setExportingExcel(false)
    }
  }

  const handleExportDatabase = async () => {
    setExportingDb(true)
    setError('')
    try {
      await exportDatabaseJson()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export databáze se nezdařil')
    } finally {
      setExportingDb(false)
    }
  }

  const handleDeleteTestData = async () => {
    setDeleting(true)
    setError('')
    setCleanupResult(null)
    try {
      const result = await deleteTestData(confirmPhrase)
      setCleanupResult(result)
      setConfirmPhrase('')
      await loadAudit()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mazání testovacích dat se nezdařilo')
    } finally {
      setDeleting(false)
    }
  }

  const canDelete = confirmPhrase === TEST_DATA_CONFIRM_PHRASE && !deleting

  return (
    <AppLayout title="Data a zálohy">
      <PageHeader
        title="Data a zálohy"
        description="Export dat do Excelu, záloha databáze a bezpečné vymazání testovacích dat."
      />

      {error && (
        <Card className="mb-4 border-red-500/30 bg-red-500/10">
          <p className="text-sm text-red-300">{error}</p>
        </Card>
      )}

      <div className="space-y-6">
        <Card>
          <div className="mb-4 flex items-start gap-3">
            <FileSpreadsheet className="mt-0.5 h-5 w-5 text-theme-secondary" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-theme-primary">Export do Excelu</h3>
              <p className="mt-1 text-sm text-theme-secondary">
                Stáhne CSV soubory kompatibilní s Excel (české oddělovače) pro hlavní tabulky ERP –
                zaměstnance, zakázky, docházku, formuláře, paragony a další.
              </p>
            </div>
          </div>
          <Button onClick={handleExportExcel} loading={exportingExcel}>
            <Download className="h-4 w-4" />
            Exportovat do Excelu
          </Button>
        </Card>

        <Card>
          <div className="mb-4 flex items-start gap-3">
            <Database className="mt-0.5 h-5 w-5 text-theme-secondary" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-theme-primary">Export databáze</h3>
              <p className="mt-1 text-sm text-theme-secondary">
                Stáhne kompletní JSON zálohu exportovatelných tabulek včetně nastavení, profilů a
                obsahových dat. Struktura databáze a migrace zůstávají nedotčeny.
              </p>
            </div>
          </div>
          <Button variant="secondary" onClick={handleExportDatabase} loading={exportingDb}>
            <Download className="h-4 w-4" />
            Exportovat databázi (JSON)
          </Button>
        </Card>

        <Card>
          <div className="mb-4 flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-orange-400" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-theme-primary">Přehled dat</h3>
              <p className="mt-1 text-sm text-theme-secondary">
                Počty řádků v tabulkách určených k bezpečnému vymazání testovacích dat.
              </p>
            </div>
          </div>

          {auditLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            </div>
          ) : audit ? (
            <div className="space-y-6">
              <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
                <p className="text-sm text-orange-200">
                  K smazání: <strong>{audit.totalDeletableRows}</strong> řádků v obsahových tabulkách
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-theme-primary">Obsahové tabulky</h4>
                  <ul className="max-h-56 space-y-1 overflow-y-auto text-sm text-theme-secondary">
                    {audit.deletableTables
                      .filter((item) => (item.count ?? 0) > 0)
                      .map((item) => (
                        <li key={item.table}>
                          {item.table}: <strong>{item.count}</strong>
                        </li>
                      ))}
                    {audit.deletableTables.every((item) => !item.count) && (
                      <li>Žádná obsahová data k smazání</li>
                    )}
                  </ul>
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-semibold text-theme-primary">Zachováno (nemazat)</h4>
                  <ul className="space-y-1 text-sm text-theme-secondary">
                    {PRESERVED_ENTITIES.map((table) => {
                      const item = audit.preservedTables.find((row) => row.table === table)
                      return (
                        <li key={table}>
                          {PRESERVED_ENTITY_LABELS[table]}: <strong>{item?.count ?? 0}</strong>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}
        </Card>

        <Card className="border-red-500/30">
          <div className="mb-4 flex items-start gap-3">
            <Trash2 className="mt-0.5 h-5 w-5 text-red-400" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-300">Vymazání testovacích dat</h3>
              <p className="mt-2 text-sm text-theme-secondary">
                Smaže obsahové a testovací záznamy (docházku, zakázky, formuláře, fotky, paragony
                apod.). <strong>Nesmaže</strong> zaměstnance, uživatele, firmu, nastavení ani strukturu
                databáze.
              </p>
            </div>
          </div>

          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            <p className="font-semibold">Varování</p>
            <p className="mt-2">
              Tato akce je nevratná. Před pokračováním doporučujeme export databáze. Zaměstnanci,
              uživatelské účty, firemní údaje a nastavení aplikace zůstanou zachovány.
            </p>
          </div>

          <Input
            label={`Pro potvrzení napište: ${TEST_DATA_CONFIRM_PHRASE}`}
            value={confirmPhrase}
            onChange={(e) => setConfirmPhrase(e.target.value)}
            placeholder={TEST_DATA_CONFIRM_PHRASE}
            autoComplete="off"
          />

          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="danger" disabled={!canDelete} loading={deleting} onClick={handleDeleteTestData}>
              <Trash2 className="h-4 w-4" />
              Vymazat testovací data
            </Button>
            <Button variant="secondary" onClick={() => void loadAudit()} disabled={auditLoading || deleting}>
              Obnovit přehled
            </Button>
          </div>

          {cleanupResult && (
            <div className="mt-6 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-200">
              <p className="font-semibold">Mazání dokončeno</p>
              <p className="mt-2">
                Smazáno storage souborů: {cleanupResult.deletedStorageFiles}
              </p>
              <ul className="mt-2 space-y-1">
                {Object.entries(cleanupResult.deletedTables).map(([table, count]) => (
                  <li key={table}>
                    {table}: {count} řádků
                  </li>
                ))}
              </ul>
              {cleanupResult.skippedTables.length > 0 && (
                <div className="mt-3 text-orange-200">
                  <p className="font-medium">Přeskočeno:</p>
                  <ul className="mt-1 space-y-1">
                    {cleanupResult.skippedTables.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  )
}
