import { formatDate } from '@/constants/workers'
import {
  buildProfessionalDocumentFooter,
  buildProfessionalDocumentHeader,
  buildProfessionalPrintDocument,
  openPrintDocument,
} from '@/lib/print/printDocument'
import {
  additionalTermsSection,
  amendmentSection,
  businessTermsSection,
  closingSection,
  employmentTermsSection,
  handoverProtocolSection,
  legalIntro,
  orderReferenceSection,
  partiesSection,
  signatureSection,
} from '@/lib/contracts/contractTemplates'
import type { ContractData, DocumentType } from '@/types/contracts'
import { generateDocumentNumber } from '@/lib/contracts/contractNumbering'

const DOCUMENT_TITLES: Record<DocumentType, string> = {
  HPP: 'Pracovní smlouva',
  DPP: 'Dohoda o provedení práce',
  DPC: 'Dohoda o pracovní činnosti',
  SMLOUVA_O_DILO: 'Smlouva o dílo',
  RAMCOVA_SMLOUVA: 'Rámcová smlouva',
  OBJEDNAVKA: 'Objednávka',
  PREDAVACI_PROTOKOL: 'Předávací protokol',
  DODATEK: 'Dodatek ke smlouvě',
}

function buildContractBody(data: ContractData): string {
  const { documentType } = data
  let body = legalIntro(documentType)
  body += partiesSection(data)

  if (documentType === 'HPP' || documentType === 'DPP' || documentType === 'DPC') {
    if (!data.worker) throw new Error('Chybí údaje zaměstnance')
    body += employmentTermsSection(data)
  } else if (documentType === 'DODATEK') {
    body += orderReferenceSection(data)
    body += amendmentSection(data)
  } else if (documentType === 'PREDAVACI_PROTOKOL') {
    body += orderReferenceSection(data)
    body += handoverProtocolSection(data)
  } else {
    body += orderReferenceSection(data)
    body += businessTermsSection(data)
  }

  body += additionalTermsSection(data.supplemental)
  body += closingSection()
  body += signatureSection(data.company, data.worker, data.order)
  return body
}

function resolveDocumentMeta(data: ContractData) {
  const title = DOCUMENT_TITLES[data.documentType]
  const documentNumber = data.documentNumber || generateDocumentNumber(data.documentType)
  const createdAt = data.createdAt ? formatDate(data.createdAt) : formatDate(new Date().toISOString().slice(0, 10))
  return { title, documentNumber, createdAt }
}

export function buildContractPrintHtml(data: ContractData): string {
  const { company } = data
  const meta = resolveDocumentMeta(data)
  return `${buildProfessionalDocumentHeader(company, meta)}${buildContractBody(data)}${buildProfessionalDocumentFooter(company, meta.createdAt)}`
}

export function buildContractDocumentTitle(data: ContractData): string {
  const title = DOCUMENT_TITLES[data.documentType]
  if (data.worker) {
    return `${title} – ${data.worker.last_name} ${data.worker.first_name}`
  }
  if (data.order) {
    return `${title} – ${data.order.name}`
  }
  return title
}

export function buildContractHtmlDocument(data: ContractData): string {
  const { company } = data
  const meta = resolveDocumentMeta(data)
  const content = `${buildProfessionalDocumentHeader(company, meta)}${buildContractBody(data)}${buildProfessionalDocumentFooter(company, meta.createdAt)}`
  return buildProfessionalPrintDocument(buildContractDocumentTitle(data), content, { company })
}

export function getDocumentTitle(type: DocumentType): string {
  return DOCUMENT_TITLES[type]
}

export function printContractDocument(data: ContractData): void {
  openPrintDocument(buildContractHtmlDocument(data))
}

export function downloadContractDocument(data: ContractData): void {
  const html = buildContractHtmlDocument(data)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${buildContractDocumentTitle(data).replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')}.html`
  link.click()
  URL.revokeObjectURL(url)
}

export { generateDocumentNumber }
