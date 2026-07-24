import { supabase } from '@/lib/supabase'
import { parseExcavationPoints } from '@/lib/excavations/geometry'
import type {
  ExcavationRoute,
  ExcavationRouteCreateInput,
  ExcavationRouteFilters,
} from '@/types/excavations'

type ExcavationRouteRow = ExcavationRoute & {
  job_orders: { name: string } | null
  creator: { full_name: string; email: string } | null
}

function mapRow(row: ExcavationRouteRow): ExcavationRoute {
  return {
    id: row.id,
    order_id: row.order_id,
    name: row.name,
    note: row.note,
    color: row.color,
    points: parseExcavationPoints(row.points),
    total_length_m: Number(row.total_length_m),
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    order_name: row.job_orders?.name ?? row.order_name,
    creator_name: row.creator?.full_name?.trim() || row.creator?.email || undefined,
  }
}

export async function fetchExcavationRoutes(
  filters: ExcavationRouteFilters = {}
): Promise<ExcavationRoute[]> {
  let query = supabase
    .from('excavation_routes')
    .select('*, job_orders(name), creator:profiles!excavation_routes_created_by_fkey(full_name, email)')
    .order('created_at', { ascending: false })

  if (filters.orderId) query = query.eq('order_id', filters.orderId)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data ?? []) as ExcavationRouteRow[]).map(mapRow)
}

export async function createExcavationRoute(
  input: ExcavationRouteCreateInput,
  createdBy: string
): Promise<ExcavationRoute> {
  const { data, error } = await supabase
    .from('excavation_routes')
    .insert({
      order_id: input.order_id,
      name: input.name.trim(),
      note: input.note?.trim() || null,
      color: input.color,
      points: input.points,
      total_length_m: input.total_length_m,
      created_by: createdBy,
    })
    .select('*, job_orders(name), creator:profiles!excavation_routes_created_by_fkey(full_name, email)')
    .single()

  if (error) throw new Error(error.message)
  return mapRow(data as ExcavationRouteRow)
}

export async function updateExcavationRoute(
  id: string,
  input: Partial<ExcavationRouteCreateInput>
): Promise<ExcavationRoute> {
  const payload: Record<string, unknown> = {}
  if (input.order_id) payload.order_id = input.order_id
  if (input.name != null) payload.name = input.name.trim()
  if (input.note !== undefined) payload.note = input.note?.trim() || null
  if (input.color) payload.color = input.color
  if (input.points) payload.points = input.points
  if (input.total_length_m != null) payload.total_length_m = input.total_length_m

  const { data, error } = await supabase
    .from('excavation_routes')
    .update(payload)
    .eq('id', id)
    .select('*, job_orders(name), creator:profiles!excavation_routes_created_by_fkey(full_name, email)')
    .single()

  if (error) throw new Error(error.message)
  return mapRow(data as ExcavationRouteRow)
}

export async function deleteExcavationRoute(id: string): Promise<void> {
  const { error } = await supabase.from('excavation_routes').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
