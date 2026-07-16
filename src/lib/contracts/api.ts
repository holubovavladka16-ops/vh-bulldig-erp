import { supabase } from '@/lib/supabase'
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

async function uploadCompanyArchive(data: ContractData, file: File): Promise<void> {
  const folder = data.order?.id ? `company/orders/${data.order.id}` : 'company/contracts'
  const path = `${folder}/${data.documentNumber ?? Date.now()}_${file.name}`
  const { error } = await supabase.storage.from('worker-documents').upload(path, file, { upsert: true })
  if (error) throw new Error(error.message)
}

export async function saveContractDocument(
  workerId: string | null,
  data: ContractData,
  uploadedBy: string
): Promise<void> {
  const html = buildContractHtmlDocument(data)
  const title = buildContractDocumentTitle(data)
  const fileName = `${(data.documentNumber ?? data.documentType).toLowerCase()}_${Date.now()}.html`
  const file = new File([html], fileName, { type: 'text/html;charset=utf-8' })

  if (workerId) {
    await uploadDocument(workerId, resolveCategory(data.documentType), title, file, uploadedBy)
    return
  }

  await uploadCompanyArchive(data, file)
}
