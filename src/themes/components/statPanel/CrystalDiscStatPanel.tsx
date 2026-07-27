import type { StatPanelProps } from '@/themes/engine/types'

/**
 * Varianta 14 – Executive Crystal Disc.
 *
 * Statistický panel se stejnými daty jako výchozí `DefaultStatPanel`, ale
 * s kruhovým chromovo-zlatým odznakem ikony a hodnotou umístěnou uprostřed
 * panelu místo standardního layoutu "text vlevo, ikona vpravo".
 */
export function CrystalDiscStatPanel({ label, value, icon: Icon, sublabel }: StatPanelProps) {
  return (
    <div
      className="flex flex-col items-center gap-2 rounded-2xl p-5 text-center"
      style={{
        background: 'var(--bg-glass)',
        border: '1px solid var(--border-glass)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 20px rgba(0,0,0,0.08)',
      }}
    >
      <span
        className="flex h-12 w-12 items-center justify-center rounded-full"
        style={{
          background:
            'conic-gradient(from 200deg, rgba(192,160,68,0.55), rgba(255,255,255,0.18) 25%, rgba(143,143,148,0.5) 50%, rgba(255,255,255,0.18) 75%, rgba(192,160,68,0.55))',
          boxShadow: '0 0 0 2px rgba(255,255,255,0.55) inset',
        }}
      >
        <Icon className="h-5 w-5 text-theme-primary" />
      </span>
      <p className="text-2xl font-bold text-theme-primary">{value}</p>
      <p className="text-sm text-theme-secondary">{label}</p>
      {sublabel && <p className="text-xs text-theme-muted">{sublabel}</p>}
    </div>
  )
}
