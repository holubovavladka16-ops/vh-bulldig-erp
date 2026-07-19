import { supabase } from '@/lib/supabase'
import { getTypFotografieLabel } from '@/constants/fotodokumentace'

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

interface GenerateNameInput {
  date: Date
  orderName: string
  photoType?: string | null
  orderId: string
}

export async function generateFotoFileName(input: GenerateNameInput): Promise<string> {
  const datePart = input.date.toISOString().slice(0, 10)
  const orderPart = slugify(input.orderName) || 'zakazka'
  const typePart = slugify(getTypFotografieLabel(input.photoType)) || 'foto'

  const prefix = `${datePart}_${orderPart}_${typePart}`

  const { count, error } = await supabase
    .from('gps_photos')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', input.orderId)
    .ilike('file_name', `${prefix}_%`)

  const seq = (error ? 0 : count ?? 0) + 1
  return `${prefix}_${String(seq).padStart(3, '0')}.jpg`
}
