import { Card } from '@/components/ui/Card'
import type { StatPanelProps } from '@/themes/engine/types'

/**
 * Výchozí statistický panel – přesně stejný vzhled, jaký měla aplikace
 * před zavedením Theme Engine.
 */
export function DefaultStatPanel({ label, value, icon: Icon, sublabel }: StatPanelProps) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-theme-secondary">{label}</p>
          <p className="mt-1 text-2xl font-bold text-theme-primary">{value}</p>
          {sublabel && <p className="mt-1 text-xs text-theme-muted">{sublabel}</p>}
        </div>
        <div className="rounded-xl p-3 nav-item-active">
          <Icon className="h-6 w-6 icon-neon" />
        </div>
      </div>
    </Card>
  )
}
