import { Shield, Settings } from 'lucide-react'

export function SupabaseConfigNotice() {
  return (
    <div>
      <div className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
          <Settings className="h-3.5 w-3.5" />
          Chybí konfigurace databáze
        </div>
        <h1 className="text-2xl font-bold text-theme-primary">Supabase není nakonfigurován</h1>
        <p className="mt-2 text-theme-secondary">
          Přihlášení vyžaduje připojení k Supabase. Doplňte soubor <code className="text-accent">.env.local</code>{' '}
          podle <code className="text-accent">.env.example</code> a restartujte vývojový server.
        </p>
      </div>

      <ol className="space-y-3 text-sm text-theme-secondary">
        <li>1. Vytvořte projekt na supabase.com nebo spusťte lokálně <code>npx supabase start</code>.</li>
        <li>2. Zkopírujte Project URL a anon key do <code>.env.local</code>.</li>
        <li>3. Spusťte SQL migrace ze složky <code>supabase/migrations</code>.</li>
        <li>4. Spusťte <code>npm run bootstrap-admin</code> pro vytvoření administrátora.</li>
        <li>5. Restartujte <code>npm run dev</code>.</li>
      </ol>

      <div className="mt-6 flex items-start gap-2 rounded-xl border border-[var(--border-glass)] bg-white/5 px-4 py-3 text-xs text-theme-muted">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 icon-neon" />
        <span>
          Bez platného Supabase připojení nelze ověřit heslo ani načíst profil administrátora.
        </span>
      </div>
    </div>
  )
}
