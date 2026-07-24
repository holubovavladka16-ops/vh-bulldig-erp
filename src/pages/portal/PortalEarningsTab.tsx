import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { portalGetEarningsSummary } from '@/lib/workers/api'
import type { WorkerEarningsSummary } from '@/types/workers'
import { formatCurrency } from '@/constants/workers'
import { Wallet, Clock, Ruler, ClipboardList, Banknote } from 'lucide-react'

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
    return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" /></div>
  }

  if (!summary) {
    return <Card className="text-center text-theme-muted">Data nejsou k dispozici.</Card>
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
    <div className="grid gap-4 sm:grid-cols-2">
      {stats.map((s) => (
        <Card key={s.label}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-theme-secondary">{s.label}</p>
              <p className="mt-1 text-2xl font-bold text-theme-primary">{s.value}</p>
            </div>
            <div className="rounded-xl p-3 nav-item-active">
              <s.icon className="h-5 w-5 icon-neon" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
