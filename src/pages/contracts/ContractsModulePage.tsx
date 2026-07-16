import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Eye, FileDown, Printer, Save } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { useAuth } from '@/context/AuthContext'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import { fetchWorkers } from '@/lib/workers/api'
import { fetchJobOrders } from '@/lib/orders/api'
import {
  buildContractHtmlDocument,
  downloadContractDocument,
  printContractDocument,
} from '@/lib/contracts/contractDocument'
import { openPreviewDocument } from '@/lib/print/printDocument'
import { saveContractDocument } from '@/lib/contracts/api'
import { validateContractData } from '@/lib/contracts/contractValidation'
import {
  buildDocumentData,
  DOCUMENT_TYPE_OPTIONS,
  documentRequiresOrder,
  documentRequiresWorker,
  EMPTY_CONTRACT_SUPPLEMENTAL,
  resolveDefaultContractType,
  generateDocumentNumber,
  type ContractSupplemental,
  type DocumentType,
} from '@/types/contracts'
import { EMPLOYMENT_TYPE_LABELS, formatDate } from '@/constants/workers'
import type { Worker } from '@/types/workers'
import type { JobOrder } from '@/types/orders'
import { DEFAULT_COMPANY_SETTINGS } from '@/types'

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-theme-muted">{label}</p>
      <p className="font-medium text-theme-primary">{value || '—'}</p>
    </div>
  )
}

export function ContractsModulePage() {
  const { user } = useAuth()
  const { settings: companySettings, loading: companyLoading } = useCompanySettings()
  const company = companySettings ?? { ...DEFAULT_COMPANY_SETTINGS, id: '', updated_at: '', updated_by: null }
  const [workers, setWorkers] = useState<Worker[]>([])
  const [orders, setOrders] = useState<JobOrder[]>([])
  const [documentType, setDocumentType] = useState<DocumentType>('HPP')
  const [workerId, setWorkerId] = useState('')
  const [orderId, setOrderId] = useState('')
  const [supplemental, setSupplemental] = useState<ContractSupplemental>(EMPTY_CONTRACT_SUPPLEMENTAL)
  const [documentNumber, setDocumentNumber] = useState(() => generateDocumentNumber('HPP'))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [w, o] = await Promise.all([
          fetchWorkers('aktivni'),
          fetchJobOrders({ status: 'aktivni' }),
        ])
        setWorkers(w)
        setOrders(o)
        if (w[0]) setWorkerId(w[0].id)
        if (o[0]) setOrderId(o[0].id)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    setDocumentNumber(generateDocumentNumber(documentType))
  }, [documentType])

  const selectedWorker = workers.find((w) => w.id === workerId) ?? null
  const selectedOrder = orders.find((o) => o.id === orderId) ?? null

  const documentData = useMemo(() => {
    if (!company) return null
    const worker = selectedWorker
    const order = selectedOrder
    const base = buildDocumentData(company, documentType, supplemental, worker, order)
    return { ...base, documentNumber, createdAt: new Date().toISOString().slice(0, 10) }
  }, [company, documentType, supplemental, selectedWorker, selectedOrder, documentNumber])

  function ensureValid(): boolean {
    if (!documentData) return false
    const validationError = validateContractData(documentData)
    if (validationError) {
      setError(validationError)
      return false
    }
    setError('')
    return true
  }

  function updateSupplemental<K extends keyof ContractSupplemental>(key: K, value: ContractSupplemental[K]) {
    setSupplemental((prev) => ({ ...prev, [key]: value }))
  }

  function handlePreview() {
    if (!documentData || !ensureValid()) return
    openPreviewDocument(buildContractHtmlDocument(documentData))
  }

  function handlePrint() {
    if (!documentData || !ensureValid()) return
    printContractDocument(documentData)
  }

  function handleDownload() {
    if (!documentData || !ensureValid()) return
    downloadContractDocument(documentData)
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!documentData || !user || !ensureValid()) return

    if (documentRequiresWorker(documentType) && !selectedWorker) {
      setError('Vyberte zaměstnance.')
      return
    }
    if (documentRequiresOrder(documentType) && !selectedOrder) {
      setError('Vyberte zakázku.')
      return
    }

    setSaving(true)
    setError('')
    try {
      await saveContractDocument(selectedWorker?.id ?? null, documentData, user.id)
      setSupplemental(EMPTY_CONTRACT_SUPPLEMENTAL)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení dokumentu se nezdařilo')
    } finally {
      setSaving(false)
    }
  }

  const isEmploymentDoc = documentType === 'HPP' || documentType === 'DPP' || documentType === 'DPC'
  const isAmendment = documentType === 'DODATEK'
  const isBusinessDoc = documentRequiresOrder(documentType)

  const workerOptions = workers.map((w) => ({
    value: w.id,
    label: `${w.last_name} ${w.first_name}`,
  }))

  const orderOptions = orders.map((o) => ({
    value: o.id,
    label: `${o.name}${o.location ? ` — ${o.location}` : ''}`,
  }))

  const typeOptions = DOCUMENT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))

  return (
    <AppLayout>
      <PageHeader
        title="Smlouvy a dokumenty"
        description="Generování pracovních smluv, obchodních dokumentů a dodatků s exportem do PDF (A4)."
      />

      {loading || companyLoading ? (
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="mx-auto max-w-5xl space-y-6">
          <Card className="space-y-4">
            <Select
              label="Typ dokumentu"
              options={typeOptions}
              value={documentType}
              onChange={(e) => {
                const next = e.target.value as DocumentType
                setDocumentType(next)
                if (selectedWorker && (next === 'HPP' || next === 'DPP' || next === 'DPC')) {
                  setDocumentType(resolveDefaultContractType(selectedWorker) === next ? next : next)
                }
              }}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Zaměstnanec"
                options={[{ value: '', label: '— vyberte —' }, ...workerOptions]}
                value={workerId}
                onChange={(e) => setWorkerId(e.target.value)}
              />
              <Select
                label="Zakázka"
                options={[{ value: '', label: '— vyberte —' }, ...orderOptions]}
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
              />
            </div>
          </Card>

          {selectedWorker && (
            <Card>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-accent">
                Údaje zaměstnance (automaticky)
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <ReadOnlyField label="Jméno" value={selectedWorker.first_name} />
                <ReadOnlyField label="Příjmení" value={selectedWorker.last_name} />
                <ReadOnlyField label="Datum narození" value={formatDate(selectedWorker.birth_date)} />
                <ReadOnlyField label="Adresa" value={selectedWorker.address} />
                <ReadOnlyField label="Pozice" value={selectedWorker.position} />
                <ReadOnlyField
                  label="Typ poměru"
                  value={EMPLOYMENT_TYPE_LABELS[selectedWorker.employment_type]}
                />
              </div>
            </Card>
          )}

          {selectedOrder && (
            <Card>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-accent">
                Údaje zakázky (automaticky)
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <ReadOnlyField label="Název" value={selectedOrder.name} />
                <ReadOnlyField label="Místo" value={selectedOrder.location ?? ''} />
                <ReadOnlyField label="Zákazník" value={selectedOrder.client_name ?? ''} />
                <ReadOnlyField label="Číslo smlouvy" value={selectedOrder.order_number ?? ''} />
              </div>
            </Card>
          )}

          <Card>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-accent">
              Údaje společnosti (automaticky)
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {company.logo_url && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <p className="mb-2 text-xs text-theme-muted">Logo VH Bulldig</p>
                  <img src={company.logo_url} alt="Logo VH Bulldig" className="max-h-16 rounded-lg" />
                </div>
              )}
              <ReadOnlyField label="Společnost" value={company.company_name} />
              <ReadOnlyField label="IČO" value={company.ico} />
              <ReadOnlyField label="DIČ" value={company.dic} />
              <ReadOnlyField
                label="Adresa"
                value={[company.address, company.postal_code, company.city].filter(Boolean).join(', ')}
              />
              <ReadOnlyField label="Jednatel" value={company.director_name ?? ''} />
              <ReadOnlyField label="Telefon" value={company.phone} />
              <ReadOnlyField label="E-mail" value={company.email} />
              <ReadOnlyField label="Web" value={company.website} />
              <ReadOnlyField label="Číslo dokumentu" value={documentNumber} />
            </div>
          </Card>

          <Card className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-theme-primary">
              Doplňující údaje
            </h3>

            {isEmploymentDoc && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Místo výkonu práce"
                  value={supplemental.workplace}
                  onChange={(e) => updateSupplemental('workplace', e.target.value)}
                />
                <Input
                  label="Výše mzdy / odměny"
                  value={supplemental.salary}
                  onChange={(e) => updateSupplemental('salary', e.target.value)}
                />
                <Input
                  label="Týdenní pracovní doba"
                  value={supplemental.weekly_hours}
                  onChange={(e) => updateSupplemental('weekly_hours', e.target.value)}
                />
                {documentType === 'HPP' ? (
                  <Input
                    label="Zkušební doba"
                    value={supplemental.trial_period}
                    onChange={(e) => updateSupplemental('trial_period', e.target.value)}
                  />
                ) : (
                  <>
                    <Input
                      label="Doba trvání"
                      value={supplemental.contract_duration}
                      onChange={(e) => updateSupplemental('contract_duration', e.target.value)}
                    />
                    <Input
                      label="Zkušební doba"
                      value={supplemental.trial_period}
                      onChange={(e) => updateSupplemental('trial_period', e.target.value)}
                    />
                  </>
                )}
              </div>
            )}

            {(isBusinessDoc || documentType === 'SMLOUVA_O_DILO' || documentType === 'RAMCOVA_SMLOUVA') && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Předmět plnění"
                  value={supplemental.subject}
                  onChange={(e) => updateSupplemental('subject', e.target.value)}
                />
                <Input
                  label="Cena / odměna"
                  value={supplemental.total_price}
                  onChange={(e) => updateSupplemental('total_price', e.target.value)}
                />
                <Input
                  label="Platební podmínky"
                  value={supplemental.payment_terms}
                  onChange={(e) => updateSupplemental('payment_terms', e.target.value)}
                />
                <Input
                  label="Termín plnění"
                  type="date"
                  value={supplemental.delivery_date}
                  onChange={(e) => updateSupplemental('delivery_date', e.target.value)}
                />
                <Input
                  label="Místo plnění"
                  value={supplemental.delivery_place}
                  onChange={(e) => updateSupplemental('delivery_place', e.target.value)}
                />
                <Textarea
                  label="Rozsah / popis prací"
                  value={supplemental.scope_description}
                  onChange={(e) => updateSupplemental('scope_description', e.target.value)}
                  className="sm:col-span-2"
                />
              </div>
            )}

            {isAmendment && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Číslo dodatku"
                  value={supplemental.amendment_number}
                  onChange={(e) => updateSupplemental('amendment_number', e.target.value)}
                />
                <Input
                  label="Reference původní smlouvy"
                  value={supplemental.contract_reference}
                  onChange={(e) => updateSupplemental('contract_reference', e.target.value)}
                />
                <Textarea
                  label="Předmět dodatku"
                  value={supplemental.amendment_subject}
                  onChange={(e) => updateSupplemental('amendment_subject', e.target.value)}
                  className="sm:col-span-2"
                />
              </div>
            )}

            <Textarea
              label="Další ujednání"
              value={supplemental.additional_terms}
              onChange={(e) => updateSupplemental('additional_terms', e.target.value)}
            />
          </Card>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
            <Button type="button" variant="secondary" onClick={handlePreview} className="w-full sm:w-auto">
              <Eye className="h-4 w-4" />
              Náhled
            </Button>
            <Button type="button" variant="secondary" onClick={handlePrint} className="w-full sm:w-auto">
              <Printer className="h-4 w-4" />
              Tisk / PDF
            </Button>
            <Button type="button" variant="secondary" onClick={handleDownload} className="w-full sm:w-auto">
              <FileDown className="h-4 w-4" />
              Uložit HTML
            </Button>
            <Button type="submit" loading={saving} className="w-full sm:w-auto">
              <Save className="h-4 w-4" />
              {selectedWorker ? 'Uložit do dokumentů zaměstnance' : 'Uložit do firemního archivu'}
            </Button>
          </div>
        </form>
      )}
    </AppLayout>
  )
}
