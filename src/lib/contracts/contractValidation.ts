import {
  documentRequiresOrder,
  documentRequiresWorker,
  type ContractData,
  type DocumentType,
} from '@/types/contracts'

function isEmploymentType(type: DocumentType): boolean {
  return type === 'HPP' || type === 'DPP' || type === 'DPC'
}

export function validateContractData(data: ContractData): string | null {
  if (!data.company.company_name?.trim()) {
    return 'Doplňte firemní údaje v Nastavení → Společnost.'
  }

  if (documentRequiresWorker(data.documentType) && !data.worker) {
    return 'Vyberte zaměstnance pro tento typ dokumentu.'
  }

  if (documentRequiresOrder(data.documentType) && !data.order) {
    return 'Vyberte zakázku pro tento typ dokumentu.'
  }

  if (isEmploymentType(data.documentType)) {
    if (!data.supplemental.salary?.trim()) return 'Vyplňte výši mzdy nebo odměny.'
    if (!data.supplemental.workplace?.trim() && !data.order?.location) {
      return 'Vyplňte místo výkonu práce.'
    }
  }

  if (data.documentType === 'DODATEK') {
    if (!data.supplemental.contract_reference?.trim() && !data.order?.contract_number) {
      return 'Vyplňte referenci původní smlouvy.'
    }
    if (!data.supplemental.amendment_subject?.trim()) {
      return 'Vyplňte předmět dodatku.'
    }
  }

  if (
    data.documentType === 'SMLOUVA_O_DILO' ||
    data.documentType === 'RAMCOVA_SMLOUVA' ||
    data.documentType === 'OBJEDNAVKA' ||
    data.documentType === 'PREDAVACI_PROTOKOL'
  ) {
    if (!data.supplemental.subject?.trim() && !data.order?.name) {
      return 'Vyplňte předmět plnění.'
    }
  }

  return null
}
