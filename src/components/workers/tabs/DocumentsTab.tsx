import { useEffect, useState, useCallback } from 'react'
import { Upload, Trash2, FileText, FileSignature } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { ContractCreateModal } from '@/components/workers/ContractCreateModal'
import { useAuth } from '@/context/AuthContext'
import { fetchDocuments, uploadDocument, deleteDocument } from '@/lib/workers/api'
import type { Worker, WorkerDocument, WorkerDocumentCategory } from '@/types/workers'
import { DOCUMENT_CATEGORY_LABELS, formatDate } from '@/constants/workers'
import { supabase } from '@/lib/supabase'

interface DocumentsTabProps {
  worker: Worker
  isAdmin: boolean
}

const categoryOptions = (Object.keys(DOCUMENT_CATEGORY_LABELS) as WorkerDocumentCategory[]).map((k) => ({
  value: k,
  label: DOCUMENT_CATEGORY_LABELS[k],
}))

export function DocumentsTab({ worker, isAdmin }: DocumentsTabProps) {
  const { user } = useAuth()
  const [docs, setDocs] = useState<WorkerDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<WorkerDocumentCategory>('ostatni')
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [contractModalOpen, setContractModalOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setDocs(await fetchDocuments(worker.id))
    setLoading(false)
  }, [worker.id])

  useEffect(() => { load() }, [worker.id, load])

  async function handleUpload() {
    if (!file || !title.trim() || !user) return
    setUploading(true)
    try {
      await uploadDocument(worker.id, category, title, file, user.id)
      setTitle('')
      setFile(null)
      await load()
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(doc: WorkerDocument) {
    if (!confirm('Smazat dokument?')) return
    await deleteDocument(doc.id, doc.file_path)
    await load()
  }

  async function openDocument(path: string) {
    const { data } = supabase.storage.from('worker-documents').getPublicUrl(path)
    window.open(data.publicUrl, '_blank')
  }

  if (loading) {
    return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" /></div>
  }

  return (
    <div className="space-y-6">
      {isAdmin && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-theme-primary">Pracovní smlouva</h3>
              <p className="text-sm text-theme-muted">
                Systém automaticky načte údaje zaměstnance a společnosti z karty a nastavení.
              </p>
            </div>
            <Button onClick={() => setContractModalOpen(true)}>
              <FileSignature className="h-4 w-4" />
              Vytvořit smlouvu
            </Button>
          </div>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <h3 className="mb-4 font-semibold text-theme-primary">Nahrát dokument</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Kategorie" options={categoryOptions} value={category} onChange={(e) => setCategory(e.target.value as WorkerDocumentCategory)} />
            <Input label="Název" value={title} onChange={(e) => setTitle(e.target.value)} />
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-theme-secondary">Soubor</label>
              <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="input-glass w-full rounded-xl px-3 py-2 text-sm" />
            </div>
          </div>
          <Button className="mt-4" onClick={handleUpload} loading={uploading} disabled={!file || !title.trim()}>
            <Upload className="h-4 w-4" />Nahrát
          </Button>
        </Card>
      )}

      {docs.length === 0 ? (
        <Card className="text-center text-theme-muted">Žádné dokumenty.</Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {docs.map((doc) => (
            <Card key={doc.id} padding className="flex items-start gap-3">
              <FileText className="h-8 w-8 shrink-0 icon-neon" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-theme-primary">{doc.title}</p>
                <p className="text-xs text-theme-muted">{DOCUMENT_CATEGORY_LABELS[doc.category]} · {formatDate(doc.created_at)}</p>
                <button onClick={() => openDocument(doc.file_path)} className="mt-2 text-sm text-accent hover:underline">Otevřít</button>
              </div>
              {isAdmin && (
                <Button variant="danger" size="sm" onClick={() => handleDelete(doc)}><Trash2 className="h-4 w-4" /></Button>
              )}
            </Card>
          ))}
        </div>
      )}

      {isAdmin && user && (
        <ContractCreateModal
          open={contractModalOpen}
          worker={worker}
          uploadedBy={user.id}
          onClose={() => setContractModalOpen(false)}
          onSaved={load}
        />
      )}
    </div>
  )
}
