import type { EmploymentType, Worker } from '@/types/workers'
import type { CompanySettings } from '@/types'
import type { JobOrder } from '@/types/orders'

const DOCUMENT_PREFIX: Record<DocumentType, string> = {
  HPP: 'PS',
  DPP: 'DPP',
  DPC: 'DPC',
  SMLOUVA_O_DILO: 'SD',
  RAMCOVA_SMLOUVA: 'RS',
  OBJEDNAVKA: 'OBJ',
  PREDAVACI_PROTOKOL: 'PP',
  DODATEK: 'DOD',
}

export function generateDocumentNumber(documentType: DocumentType): string {
  const year = new Date().getFullYear()
  const seq = String(Date.now()).slice(-6)
  return `${DOCUMENT_PREFIX[documentType]}-${year}-${seq}`
}

export type ContractType = Extract<EmploymentType, 'HPP' | 'DPP' | 'DPC'>

export type DocumentType =
  | ContractType
  | 'SMLOUVA_O_DILO'
  | 'RAMCOVA_SMLOUVA'
  | 'OBJEDNAVKA'
  | 'PREDAVACI_PROTOKOL'
  | 'DODATEK'

export interface ContractSupplemental {
  workplace: string
  salary: string
  weekly_hours: string
  trial_period: string
  contract_duration: string
  additional_terms: string
  subject: string
  scope_description: string
  total_price: string
  payment_terms: string
  delivery_date: string
  delivery_place: string
  contract_reference: string
  amendment_number: string
  amendment_subject: string
}

export interface ContractAutoWorkerData {
  first_name: string
  last_name: string
  birth_date: string
  address: string
  birth_number: string | null
  phone: string | null
  email: string | null
  start_date: string
  position: string
  employment_type: ContractType
}

export interface ContractAutoCompanyData {
  company_name: string
  logo_url: string
  ico: string
  dic: string
  address: string
  city?: string
  postal_code?: string
  phone: string
  email: string
  website: string
  bank_account: string
  director_name: string
}

export interface ContractOrderData {
  id: string
  name: string
  location: string
  client_name: string
  contract_number: string
}

export interface ContractData {
  documentType: DocumentType
  documentNumber?: string
  createdAt?: string
  worker: ContractAutoWorkerData | null
  company: ContractAutoCompanyData
  order: ContractOrderData | null
  supplemental: ContractSupplemental
}

export const EMPTY_CONTRACT_SUPPLEMENTAL: ContractSupplemental = {
  workplace: '',
  salary: '',
  weekly_hours: '',
  trial_period: '',
  contract_duration: '',
  additional_terms: '',
  subject: '',
  scope_description: '',
  total_price: '',
  payment_terms: '',
  delivery_date: '',
  delivery_place: '',
  contract_reference: '',
  amendment_number: '',
  amendment_subject: '',
}

export const DOCUMENT_TYPE_OPTIONS: { value: DocumentType; label: string; group: string }[] = [
  { value: 'HPP', label: 'Pracovní smlouva (HPP)', group: 'Pracovní poměr' },
  { value: 'DPP', label: 'Dohoda o provedení práce (DPP)', group: 'Pracovní poměr' },
  { value: 'DPC', label: 'Dohoda o pracovní činnosti (DPČ)', group: 'Pracovní poměr' },
  { value: 'SMLOUVA_O_DILO', label: 'Smlouva o dílo', group: 'Obchodní dokumenty' },
  { value: 'RAMCOVA_SMLOUVA', label: 'Rámcová smlouva', group: 'Obchodní dokumenty' },
  { value: 'OBJEDNAVKA', label: 'Objednávka', group: 'Obchodní dokumenty' },
  { value: 'PREDAVACI_PROTOKOL', label: 'Předávací protokol', group: 'Obchodní dokumenty' },
  { value: 'DODATEK', label: 'Dodatek ke smlouvě', group: 'Obchodní dokumenty' },
]

/** @deprecated Use DOCUMENT_TYPE_OPTIONS */
export const CONTRACT_TYPE_OPTIONS = DOCUMENT_TYPE_OPTIONS.filter(
  (o): o is { value: ContractType; label: string; group: string } =>
    o.value === 'HPP' || o.value === 'DPP' || o.value === 'DPC'
).map(({ value, label }) => ({ value, label }))

export function resolveDefaultContractType(worker: Worker): ContractType {
  if (worker.employment_type === 'HPP' || worker.employment_type === 'DPP' || worker.employment_type === 'DPC') {
    return worker.employment_type
  }
  return 'HPP'
}

export function documentRequiresWorker(type: DocumentType): boolean {
  return type === 'HPP' || type === 'DPP' || type === 'DPC' || type === 'DODATEK'
}

export function documentRequiresOrder(type: DocumentType): boolean {
  return (
    type === 'SMLOUVA_O_DILO' ||
    type === 'RAMCOVA_SMLOUVA' ||
    type === 'OBJEDNAVKA' ||
    type === 'PREDAVACI_PROTOKOL'
  )
}

function workerFromRecord(worker: Worker, contractType: ContractType): ContractAutoWorkerData {
  return {
    first_name: worker.first_name,
    last_name: worker.last_name,
    birth_date: worker.birth_date,
    address: worker.address,
    birth_number: worker.birth_number,
    phone: worker.phone,
    email: worker.email,
    start_date: worker.start_date,
    position: worker.position,
    employment_type: contractType,
  }
}

function companyFromSettings(company: CompanySettings): ContractAutoCompanyData {
  return {
    company_name: company.company_name,
    logo_url: company.logo_url,
    ico: company.ico,
    dic: company.dic,
    address: company.address,
    city: company.city,
    postal_code: company.postal_code,
    phone: company.phone,
    email: company.email,
    website: company.website,
    bank_account: company.bank_account,
    director_name: company.director_name ?? '',
  }
}

function orderFromRecord(order: JobOrder): ContractOrderData {
  return {
    id: order.id,
    name: order.name,
    location: order.location ?? '',
    client_name: order.client_name ?? '',
    contract_number: order.order_number ?? '',
  }
}

export function buildDocumentData(
  company: CompanySettings,
  documentType: DocumentType,
  supplemental: ContractSupplemental,
  worker?: Worker | null,
  order?: JobOrder | null
): ContractData {
  const employmentType =
    documentType === 'HPP' || documentType === 'DPP' || documentType === 'DPC'
      ? documentType
      : worker
        ? resolveDefaultContractType(worker)
        : 'HPP'

  return {
    documentType,
    worker: worker ? workerFromRecord(worker, employmentType) : null,
    company: companyFromSettings(company),
    order: order ? orderFromRecord(order) : null,
    supplemental,
  }
}

/** @deprecated Use buildDocumentData */
export function buildContractData(
  worker: Worker,
  company: CompanySettings,
  contractType: ContractType,
  supplemental: ContractSupplemental
): ContractData {
  return buildDocumentData(company, contractType, supplemental, worker, null)
}
