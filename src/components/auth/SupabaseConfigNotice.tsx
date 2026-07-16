import { Shield, Settings } from 'lucide-react'
import { getSupabaseConfigHint } from '@/lib/env'

export function SupabaseConfigNotice() {
  const isProduction = import.meta.env.PROD

  return (
    <div>
      <div className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
          <Settings className="h-3.5 w-3.5" />
          Chybí konfigurace databáze
        </div>
        <h1 className="text-2xl font-bold text-theme-primary">Supabase není nakonfigurován</h1>
        <p className="mt-2 text-theme-secondary">{getSupabaseConfigHint()}</p>
      </div>

      {isProduction ? (
        <ol className="space-y-3 text-sm text-theme-secondary">
          <li>
            1. Otevřete Supabase Dashboard → Project Settings → API a zkopírujte Project URL a{' '}
            <strong>publishable (anon) key</strong>.
          </li>
          <li>
            2. Ve Vercel → Settings → Environment Variables přidejte{' '}
            <code className="text-accent">VITE_SUPABASE_URL</code> a{' '}
            <code className="text-accent">VITE_SUPABASE_ANON_KEY</code> pro Production.
          </li>
          <li>
            3. Nebo doplňte soubor <code className="text-accent">.env.production</code> podle{' '}
            <code className="text-accent">.env.production.example</code> a redeployujte.
          </li>
          <li>4. Service role key do frontendu ani do Vercel env pro build nepatří.</li>
        </ol>
      ) : (
        <ol className="space-y-3 text-sm text-theme-secondary">
          <li>1. Vytvořte projekt na supabase.com nebo spusťte lokálně <code>npm run dev:local</code>.</li>
          <li>
            2. Zkopírujte Project URL a anon key do <code>.env.local</code> (viz{' '}
            <code>.env.example</code>).
          </li>
          <li>3. Spusťte SQL migrace ze složky <code>supabase/migrations</code>.</li>
          <li>4. Spusťte <code>npm run bootstrap-admin</code> pro vytvoření administrátora.</li>
          <li>5. Restartujte <code>npm run dev</code> nebo <code>npm run dev:local</code>.</li>
        </ol>
      )}

      <div className="mt-6 flex items-start gap-2 rounded-xl border border-[var(--border-glass)] bg-white/5 px-4 py-3 text-xs text-theme-muted">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 icon-neon" />
        <span>
          Bez platného Supabase připojení nelze ověřit heslo ani načíst profil administrátora.
        </span>
      </div>
    </div>
  )
}
