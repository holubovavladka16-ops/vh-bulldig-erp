import { uploadDocument } from '@/lib/workers/api'
import {
  buildContractDocumentTitle,
  buildContractHtmlDocument,
} from '@/lib/contracts/contractDocument'
import type { ContractData, DocumentType } from '@/types/contracts'
import type { WorkerDocumentCategory } from '@/types/workers'

function resolveCategory(type: DocumentType): WorkerDocumentCategory {
  if (type === 'DODATEK') return 'dodatek'
  if (type === 'HPP' || type === 'DPP' || type === 'DPC') return 'pracovni_smlouva'
  return 'ostatni'
}

export async function saveContractDocument(
  workerId: string | null,
  data: ContractData,
  uploadedBy: string
): Promise<void> {
  if (!workerId) {
    throw new Error('Pro uložení dokumentu vyberte zaměstnance.')
  }

  const html = buildContractHtmlDocument(data)
  const title = buildContractDocumentTitle(data)
  const fileName = `${data.documentType.toLowerCase()}_${Date.now()}.html`
  const file = new File([html], fileName, { type: 'text/html;charset=utf-8' })

  await uploadDocument(workerId, resolveCategory(data.documentType), title, file, uploadedBy)
}
