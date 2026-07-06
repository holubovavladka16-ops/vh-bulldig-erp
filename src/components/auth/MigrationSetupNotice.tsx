import { Database, Shield } from 'lucide-react'

interface MigrationSetupNoticeProps {
  message?: string
}

export function MigrationSetupNotice({ message }: MigrationSetupNoticeProps) {
  return (
    <div>
      <div className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
          <Database className="h-3.5 w-3.5" />
          Databáze není inicializovaná
        </div>
        <h1 className="text-2xl font-bold text-theme-primary">Je potřeba dokončit setup</h1>
        <p className="mt-2 text-theme-secondary">
          Supabase projekt je připojený, ale chybí ERP schéma (migrace 001–025). Bez něj nelze vytvořit
          administrátora ani se přihlásit.
        </p>
      </div>

      {message && (
        <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {message}
        </div>
      )}

      <ol className="space-y-3 text-sm text-theme-secondary">
        <li>
          1. Doplňte do <code className="text-accent">.env.local</code> jednu z hodnot:
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <code>SUPABASE_DB_PASSWORD</code> – Dashboard → Settings → Database
            </li>
            <li>
              <code>SUPABASE_ACCESS_TOKEN</code> – Dashboard → Account → Access Tokens
            </li>
          </ul>
        </li>
        <li>
          2. V terminálu spusťte: <code className="text-accent">npm run setup-complete</code>
        </li>
        <li>3. Restartujte <code className="text-accent">npm run dev</code> a přihlaste se.</li>
      </ol>

      <div className="mt-6 flex items-start gap-2 rounded-xl border border-[var(--border-glass)] bg-white/5 px-4 py-3 text-xs text-theme-muted">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 icon-neon" />
        <span>
          Přihlašovací údaje administrátora jsou v <code>.env.local</code> (INITIAL_ADMIN_EMAIL /
          INITIAL_ADMIN_PASSWORD). Po setupu je použijte na této stránce.
        </span>
      </div>
    </div>
  )
}
