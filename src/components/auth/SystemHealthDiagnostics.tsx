import { AlertTriangle, RefreshCw, Shield } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { SystemHealthReport } from '@/lib/auth/systemHealth'

interface SystemHealthDiagnosticsProps {
  report: SystemHealthReport
  onRetry: () => void
  retrying?: boolean
}

export function SystemHealthDiagnostics({
  report,
  onRetry,
  retrying = false,
}: SystemHealthDiagnosticsProps) {
  return (
    <div>
      <div className="mb-6">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5" />
          Diagnostika systému
        </div>
        <h1 className="text-2xl font-bold text-theme-primary">Systém není připraven</h1>
        <p className="mt-2 text-sm text-theme-secondary">
          Prostředí: <strong>{report.environment === 'production' ? 'produkce (Vercel)' : 'vývoj'}</strong>
          {' · '}
          Kontrola: {new Date(report.checkedAt).toLocaleString('cs-CZ')}
        </p>
      </div>

      <ul className="space-y-4">
        {report.issues.map((item) => (
          <li
            key={item.id}
            className={`rounded-xl border px-4 py-3 text-sm ${
              item.severity === 'critical'
                ? 'border-red-500/30 bg-red-500/10 text-red-200'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
            }`}
          >
            <p className="font-semibold">{item.title}</p>
            <p className="mt-1 opacity-90">{item.message}</p>
            <p className="mt-2 text-xs opacity-80">
              <strong>Řešení:</strong> {item.fix}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={onRetry} loading={retrying} variant="secondary">
          <RefreshCw className="h-4 w-4" />
          Znovu zkontrolovat
        </Button>
      </div>

      <div className="mt-6 flex items-start gap-2 rounded-xl border border-[var(--border-glass)] bg-white/5 px-4 py-3 text-xs text-theme-muted">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 icon-neon" />
        <span>
          Kontrola probíhá při každém spuštění aplikace. Po opravě konfigurace nebo migrací klikněte na
          „Znovu zkontrolovat“.
        </span>
      </div>
    </div>
  )
}
