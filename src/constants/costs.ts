import type { JobCostCategory } from '@/types/costs'

export const JOB_COST_CATEGORY_LABELS: Record<JobCostCategory, string> = {
  material: 'Materiál',
  naradi: 'Nářadí',
  pujcovna: 'Půjčovna',
  ubytovani: 'Ubytování',
  phm: 'PHM',
  jizdenky: 'Jízdenky',
  ostatni: 'Ostatní',
}

export const JOB_COST_CATEGORY_OPTIONS = (
  Object.entries(JOB_COST_CATEGORY_LABELS) as [JobCostCategory, string][]
).map(([value, label]) => ({ value, label }))
