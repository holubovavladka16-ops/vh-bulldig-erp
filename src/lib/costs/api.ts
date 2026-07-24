import { supabase } from '@/lib/supabase'
import type {
  JobCost,
  JobCostCreateInput,
  JobCostDocument,
  JobCostFilters,
  JobCostPhoto,
  JobCostWithAttachments,
} from '@/types/costs'

type JobCostRow = JobCost & {
  job_orders: { name: string } | null
}

function mapCostRow(row: JobCostRow): JobCost {
  return {
    id: row.id,
    cost_date: row.cost_date,
    order_id: row.order_id,
    order_name: row.job_orders?.name ?? row.order_name,
    name: row.name,
    category: (row.category ?? 'ostatni') as JobCost['category'],
    price: Number(row.price),
    supplier: row.supplier,
    note: row.note,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function fetchJobCosts(filters: JobCostFilters = {}): Promise<JobCost[]> {
  let query = supabase
    .from('job_costs')
    .select('*, job_orders(name)')
    .order('cost_date', { ascending: false })

  if (filters.orderId) query = query.eq('order_id', filters.orderId)
  if (filters.dateFrom) query = query.gte('cost_date', filters.dateFrom)
  if (filters.dateTo) query = query.lte('cost_date', filters.dateTo)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return ((data ?? []) as JobCostRow[]).map(mapCostRow)
}

export async function fetchJobCostWithAttachments(id: string): Promise<JobCostWithAttachments | null> {
  const { data, error } = await supabase
    .from('job_costs')
    .select('*, job_orders(name)')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const [documents, photos] = await Promise.all([
    fetchJobCostDocuments(id),
    fetchJobCostPhotos(id),
  ])

  return {
    ...mapCostRow(data as JobCostRow),
    document: documents[0] ?? null,
    photos,
  }
}

export async function createJobCost(input: JobCostCreateInput, createdBy: string): Promise<JobCost> {
  const { data, error } = await supabase
    .from('job_costs')
    .insert({
      cost_date: input.cost_date,
      order_id: input.order_id,
      name: input.name.trim(),
      category: input.category,
      price: input.price,
      supplier: input.supplier?.trim() || null,
      note: input.note?.trim() || null,
      created_by: createdBy,
    })
    .select('*, job_orders(name)')
    .single()

  if (error) throw new Error(error.message)
  return mapCostRow(data as JobCostRow)
}

export async function updateJobCost(id: string, input: Partial<JobCostCreateInput>): Promise<JobCost> {
  const payload: Record<string, unknown> = {}
  if (input.cost_date !== undefined) payload.cost_date = input.cost_date
  if (input.order_id !== undefined) payload.order_id = input.order_id
  if (input.name !== undefined) payload.name = input.name.trim()
  if (input.category !== undefined) payload.category = input.category
  if (input.price !== undefined) payload.price = input.price
  if (input.supplier !== undefined) payload.supplier = input.supplier?.trim() || null
  if (input.note !== undefined) payload.note = input.note?.trim() || null

  const { data, error } = await supabase
    .from('job_costs')
    .update(payload)
    .eq('id', id)
    .select('*, job_orders(name)')
    .single()

  if (error) throw new Error(error.message)
  return mapCostRow(data as JobCostRow)
}

export async function deleteJobCost(id: string): Promise<void> {
  const [documents, photos] = await Promise.all([
    fetchJobCostDocuments(id),
    fetchJobCostPhotos(id),
  ])

  if (documents.length > 0) {
    await supabase.storage.from('cost-documents').remove(documents.map((d) => d.file_path))
  }
  if (photos.length > 0) {
    await supabase.storage.from('cost-photos').remove(photos.map((p) => p.file_path))
  }

  const { error } = await supabase.from('job_costs').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

async function fetchJobCostDocuments(costId: string): Promise<JobCostDocument[]> {
  const { data, error } = await supabase
    .from('job_cost_documents')
    .select('*')
    .eq('cost_id', costId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as JobCostDocument[]
}

async function fetchJobCostPhotos(costId: string): Promise<JobCostPhoto[]> {
  const { data, error } = await supabase
    .from('job_cost_photos')
    .select('*')
    .eq('cost_id', costId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as JobCostPhoto[]
}

export async function uploadJobCostDocument(
  costId: string,
  file: File,
  uploadedBy: string
): Promise<JobCostDocument> {
  const existing = await fetchJobCostDocuments(costId)
  for (const doc of existing) {
    await deleteJobCostDocument(doc)
  }

  const path = `${costId}/${Date.now()}_${file.name}`
  const { error: uploadError } = await supabase.storage.from('cost-documents').upload(path, file)
  if (uploadError) throw new Error(uploadError.message)

  const { data, error } = await supabase
    .from('job_cost_documents')
    .insert({
      cost_id: costId,
      file_path: path,
      file_name: file.name,
      uploaded_by: uploadedBy,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as JobCostDocument
}

export async function deleteJobCostDocument(doc: JobCostDocument): Promise<void> {
  await supabase.storage.from('cost-documents').remove([doc.file_path])
  const { error } = await supabase.from('job_cost_documents').delete().eq('id', doc.id)
  if (error) throw new Error(error.message)
}

export async function uploadJobCostPhoto(
  costId: string,
  file: File,
  uploadedBy: string
): Promise<JobCostPhoto> {
  const path = `${costId}/${Date.now()}_${file.name}`
  const { error: uploadError } = await supabase.storage.from('cost-photos').upload(path, file)
  if (uploadError) throw new Error(uploadError.message)

  const { data, error } = await supabase
    .from('job_cost_photos')
    .insert({
      cost_id: costId,
      file_path: path,
      file_name: file.name,
      uploaded_by: uploadedBy,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as JobCostPhoto
}

export async function deleteJobCostPhoto(photo: JobCostPhoto): Promise<void> {
  await supabase.storage.from('cost-photos').remove([photo.file_path])
  const { error } = await supabase.from('job_cost_photos').delete().eq('id', photo.id)
  if (error) throw new Error(error.message)
}

export function getCostPhotoUrl(filePath: string): string {
  const { data } = supabase.storage.from('cost-photos').getPublicUrl(filePath)
  return data.publicUrl
}

export async function openCostDocument(filePath: string): Promise<void> {
  const { data, error } = await supabase.storage.from('cost-documents').download(filePath)
  if (error || !data) throw new Error(error?.message ?? 'Otevření se nezdařilo')

  const url = URL.createObjectURL(data)
  window.open(url, '_blank')
}
