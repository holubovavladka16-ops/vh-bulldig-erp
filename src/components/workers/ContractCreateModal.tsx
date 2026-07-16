import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { X, Printer, Save } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { useCompanySettings } from '@/context/CompanySettingsContext'
import { buildContractHtmlDocument } from '@/lib/contracts/contractDocument'
import { saveContractDocument } from '@/lib/contracts/api'
import { validateContractData } from '@/lib/contracts/contractValidation'
import { generateDocumentNumber } from '@/lib/contracts/contractNumbering'
import { openPrintDocument } from '@/lib/print/printDocument'
import {
  buildContractData,
  CONTRACT_TYPE_OPTIONS,
  EMPTY_CONTRACT_SUPPLEMENTAL,
  resolveDefaultContractType,
  type ContractSupplemental,
  type ContractType,
} from '@/types/contracts'
import { EMPLOYMENT_TYPE_LABELS, formatDate } from '@/constants/workers'
import type { Worker } from '@/types/workers'

interface ContractCreateModalProps {
  open: boolean
  worker: Worker
  onClose: () => void
  onSaved: () => void
  uploadedBy: string
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-theme-muted">{label}</p>
      <p className="font-medium text-theme-primary">{value || '—'}</p>
    </div>
  )
}

export function ContractCreateModal({ open, worker, onClose, onSaved, uploadedBy }: ContractCreateModalProps) {
  const { settings: company } = useCompanySettings()
  const [contractType, setContractType] = useState<ContractType>(resolveDefaultContractType(worker))
  const [supplemental, setSupplemental] = useState<ContractSupplemental>(EMPTY_CONTRACT_SUPPLEMENTAL)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setContractType(resolveDefaultContractType(worker))
    setSupplemental(EMPTY_CONTRACT_SUPPLEMENTAL)
    setError('')
  }, [open, worker])

  const contractData = useMemo(() => {
    if (!company) return null
    return {
      ...buildContractData(worker, company, contractType, supplemental),
      documentNumber: generateDocumentNumber(contractType),
      createdAt: new Date().toISOString().slice(0, 10),
    }
  }, [worker, company, contractType, supplemental])

  if (!open || !company) return null

  function updateSupplemental<K extends keyof ContractSupplemental>(key: K, value: ContractSupplemental[K]) {
    setSupplemental((prev) => ({ ...prev, [key]: value }))
  }

  function handlePreview() {
    if (!contractData) return
    const validationError = validateContractData(contractData)
    if (validationError) {
      setError(validationError)
      return
    }
    openPrintDocument(buildContractHtmlDocument(contractData))
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!contractData) return

    const validationError = validateContractData(contractData)
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    setError('')
    try {
      await saveContractDocument(worker.id, contractData, uploadedBy)
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení smlouvy se nezdařilo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal-panel modal-panel-xl glass-panel neon-border scrollbar-premium">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-theme-primary">Vytvořit pracovní smlouvu</h2>
            <p className="text-sm text-theme-muted">
              Údaje zaměstnance a společnosti se načítají automaticky z karty a nastavení.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/5" aria-label="Zavřít">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <Select
            label="Typ smlouvy"
            options={CONTRACT_TYPE_OPTIONS}
            value={contractType}
            onChange={(e) => setContractType(e.target.value as ContractType)}
          />

          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-accent">
              Údaje zaměstnance (automaticky)
            </h3>
            <div className="neon-border grid gap-4 rounded-xl p-4 sm:grid-cols-2 lg:grid-cols-3">
              <ReadOnlyField label="Jméno" value={worker.first_name} />
              <ReadOnlyField label="Příjmení" value={worker.last_name} />
              <ReadOnlyField label="Datum narození" value={formatDate(worker.birth_date)} />
              <ReadOnlyField label="Adresa" value={worker.address} />
              <ReadOnlyField label="Rodné číslo" value={worker.birth_number ?? ''} />
              <ReadOnlyField label="Telefon" value={worker.phone ?? ''} />
              <ReadOnlyField label="E-mail" value={worker.email ?? ''} />
              <ReadOnlyField label="Datum nástupu" value={formatDate(worker.start_date)} />
              <ReadOnlyField label="Pracovní pozice" value={worker.position} />
              <ReadOnlyField label="Pracovní poměr" value={EMPLOYMENT_TYPE_LABELS[contractType]} />
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-accent">
              Údaje společnosti (automaticky)
            </h3>
            <div className="neon-border grid gap-4 rounded-xl p-4 sm:grid-cols-2 lg:grid-cols-3">
              {company.logo_url && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <p className="mb-2 text-xs text-theme-muted">Logo</p>
                  <img src={company.logo_url} alt="Logo společnosti" className="max-h-16 rounded-lg" />
                </div>
              )}
              <ReadOnlyField label="Název společnosti" value={company.company_name} />
              <ReadOnlyField label="IČO" value={company.ico} />
              <ReadOnlyField label="DIČ" value={company.dic} />
              <ReadOnlyField
                label="Adresa"
                value={[company.address, company.postal_code, company.city].filter(Boolean).join(', ')}
              />
              <ReadOnlyField label="Telefon" value={company.phone} />
              <ReadOnlyField label="E-mail" value={company.email} />
              <ReadOnlyField label="Bankovní účet" value={company.bank_account} />
              <ReadOnlyField label="Jednatel společnosti" value={company.director_name ?? ''} />
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-theme-primary">
              Doplňující informace
            </h3>
            <p className="mb-4 text-sm text-theme-muted">
              Vyplňte pouze údaje, které nejsou uloženy v systému. Automaticky načtená pole se neupravují.
            </p>
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
              {contractType === 'HPP' ? (
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
              <Textarea
                label="Další ujednání"
                value={supplemental.additional_terms}
                onChange={(e) => updateSupplemental('additional_terms', e.target.value)}
                className="sm:col-span-2"
              />
            </div>
          </section>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="modal-footer pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Zrušit</Button>
            <Button type="button" variant="secondary" onClick={handlePreview}>
              <Printer className="h-4 w-4" />
              Náhled / Tisk
            </Button>
            <Button type="submit" loading={loading}>
              <Save className="h-4 w-4" />
              Uložit smlouvu
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
