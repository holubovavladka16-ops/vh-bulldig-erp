export function RouteLoader() {
  return (
    <div className="app-background flex min-h-dvh items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[var(--border-glass)] border-t-[var(--accent-primary)]" />
        <p className="text-sm text-theme-muted">Načítám modul…</p>
      </div>
    </div>
  )
}
