import { describe, expect, it } from 'vitest'
import { collectCameraDiagnostics } from '@/lib/camera/cameraDiagnostics'

describe('collectCameraDiagnostics', () => {
  it('reports zero tracks when stream is null', () => {
    const diagnostics = collectCameraDiagnostics({
      moduleId: 'test',
      phase: 'idle',
      video: null,
      stream: null,
      isStreamReady: false,
      getUserMediaError: null,
    })

    expect(diagnostics.activeVideoTracks).toBe(0)
    expect(diagnostics.mediaDevicesAvailable).toBe(
      Boolean(typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia)
    )
  })
})
