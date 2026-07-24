import type { DocumentType } from '@/types/contracts'

const PREFIX: Record<DocumentType, string> = {
  HPP: 'PS',
  DPP: 'DPP',
  DPC: 'DPC',
  SMLOUVA_O_DILO: 'SD',
  RAMCOVA_SMLOUVA: 'RS',
  OBJEDNAVKA: 'OBJ',
  PREDAVACI_PROTOKOL: 'PP',
  DODATEK: 'DOD',
}

const STORAGE_PREFIX = 'vh-bulldig-doc-seq'

export function generateDocumentNumber(documentType: DocumentType): string {
  const year = new Date().getFullYear()
  const storageKey = `${STORAGE_PREFIX}:${documentType}:${year}`

  let seq = 1
  try {
    const prev = Number(localStorage.getItem(storageKey) ?? '0')
    seq = Number.isFinite(prev) ? prev + 1 : 1
    localStorage.setItem(storageKey, String(seq))
  } catch {
    seq = Number(String(Date.now()).slice(-4))
  }

  return `${PREFIX[documentType]}-${year}-${String(seq).padStart(4, '0')}`
}
