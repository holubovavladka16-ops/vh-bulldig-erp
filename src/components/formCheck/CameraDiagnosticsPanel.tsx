import type { CameraStartupDiagnostics } from '@/hooks/useCameraStream'

interface CameraDiagnosticsPanelProps {
  diagnostics: CameraStartupDiagnostics
  phase: string
  errorMessage: string | null
  overlay?: boolean
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 font-mono text-[10px] ${
        ok ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
      }`}
    >
      {label}
    </span>
  )
}

export function CameraDiagnosticsPanel({
  diagnostics,
  phase,
  errorMessage,
  overlay = false,
}: CameraDiagnosticsPanelProps) {
  const getUserMediaOk = diagnostics.getUserMediaStatus === 'ok'
  const canPlay = diagnostics.readyState >= 2

  return (
    <div
      className={`camera-diagnostics rounded-lg border border-amber-500/40 bg-black/80 p-2 text-left font-mono text-[10px] leading-relaxed text-amber-100/90 ${
        overlay ? 'camera-diagnostics--overlay' : 'mt-2'
      }`}
    >
      <p className="mb-1 text-[11px] font-semibold text-amber-300">Diagnostika kamery</p>

      <div className="grid gap-0.5 sm:grid-cols-2">
        <p>
          fáze: <span className="text-white">{phase}</span>
        </p>
        <p>
          krok: <span className="text-white">{diagnostics.step}</span>
        </p>
        <p className="flex flex-wrap items-center gap-1">
          getUserMedia:
          <StatusBadge
            ok={getUserMediaOk}
            label={
              diagnostics.getUserMediaStatus === 'pending'
                ? 'čeká…'
                : diagnostics.getUserMediaStatus
            }
          />
        </p>
        <p>
          oprávnění:{' '}
          <span className="text-white">{diagnostics.permissionState ?? '—'}</span>
        </p>
        <p>
          video mounted:{' '}
          <StatusBadge ok={diagnostics.videoMounted} label={diagnostics.videoMounted ? 'ano' : 'ne'} />
        </p>
        <p>
          srcObject:{' '}
          <StatusBadge
            ok={diagnostics.srcObjectAssigned && diagnostics.srcObjectMatches}
            label={
              diagnostics.srcObjectAssigned
                ? diagnostics.srcObjectMatches
                  ? 'přiřazen'
                  : 'jiný objekt'
                : 'null'
            }
          />
        </p>
        <p>
          play():{' '}
          <StatusBadge
            ok={diagnostics.playOk}
            label={
              !diagnostics.playAttempted
                ? 'nevoláno'
                : diagnostics.playOk
                  ? 'OK'
                  : diagnostics.playError || 'selhalo'
            }
          />
        </p>
        <p>
          readyState:{' '}
          <StatusBadge ok={canPlay} label={diagnostics.readyStateLabel} />
        </p>
        <p>
          rozměry:{' '}
          <StatusBadge
            ok={diagnostics.videoWidth > 0 && diagnostics.videoHeight > 0}
            label={`${diagnostics.videoWidth}×${diagnostics.videoHeight}`}
          />
        </p>
        <p>
          paused: <span className="text-white">{diagnostics.paused ? 'ano' : 'ne'}</span>
        </p>
        <p>
          stream ready:{' '}
          <StatusBadge ok={diagnostics.isStreamReady} label={diagnostics.isStreamReady ? 'ano' : 'ne'} />
        </p>
      </div>

      {diagnostics.constraintsUsed && (
        <p className="mt-1 break-all text-white/70">constraints: {diagnostics.constraintsUsed}</p>
      )}
      {diagnostics.trackSummary !== '—' && (
        <p className="mt-1 break-all text-white/70">tracks: {diagnostics.trackSummary}</p>
      )}
      {diagnostics.getUserMediaError && (
        <p className="mt-1 text-red-300">getUserMedia chyba: {diagnostics.getUserMediaError}</p>
      )}
      {diagnostics.playError && (
        <p className="mt-1 text-red-300">play() chyba: {diagnostics.playError}</p>
      )}
      {errorMessage && <p className="mt-1 text-red-300">stav: {errorMessage}</p>}
    </div>
  )
}
