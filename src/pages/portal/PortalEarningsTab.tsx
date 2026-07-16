import { useEffect, useState } from 'react'
import { Wallet, Clock, Ruler, ClipboardList, Banknote } from 'lucide-react'
import { FieldModeCard } from '@/components/portal/field/FieldModeCard'
import { portalGetEarningsSummary } from '@/lib/workers/api'
import type { WorkerEarningsSummary } from '@/types/workers'
import { formatCurrency } from '@/constants/workers'

interface PortalEarningsTabProps {
  token: string
}

export function PortalEarningsTab({ token }: PortalEarningsTabProps) {
  const [summary, setSummary] = useState<WorkerEarningsSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    portalGetEarningsSummary(token).then(setSummary).finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--field-gold,#c9a227)]" />
      </div>
    )
  }

  if (!summary) {
    return <div className="field-mode-alert field-mode-alert--error">Data nejsou k dispozici.</div>
  }

  const stats = [
    { label: 'Dnešní výdělek', value: formatCurrency(summary.today_earnings), icon: Wallet },
    { label: 'Měsíční výdělek', value: formatCurrency(summary.month_earnings), icon: Wallet },
    { label: 'Odpracované hodiny', value: `${summary.month_hours} h`, icon: Clock },
    { label: 'Odpracované metry', value: `${summary.month_meters} m`, icon: Ruler },
    { label: 'Počet zakázek', value: String(summary.month_orders), icon: ClipboardList },
    { label: 'Celková výše záloh', value: formatCurrency(summary.month_advances), icon: Banknote },
  ]

  return (
    <div className="field-mode-grid">
      {stats.map((s) => (
        <FieldModeCard key={s.label} title={s.label} icon="💰">
          <div className="flex items-start justify-between gap-3">
            <p className="text-2xl font-extrabold text-[var(--field-gold)]">{s.value}</p>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <s.icon className="h-5 w-5 text-[var(--field-copper,#b87333)]" />
            </div>
          </div>
        </FieldModeCard>
      ))}
    </div>
  )
}
