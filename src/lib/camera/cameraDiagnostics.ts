export interface CameraDiagnostics {
  moduleId: string
  mediaDevicesAvailable: boolean
  permissionState: PermissionState | 'unknown' | 'unsupported'
  phase: string
  getUserMediaError: { name: string; message: string } | null
  videoReadyState: number | null
  videoWidth: number
  videoHeight: number
  activeVideoTracks: number
  trackStates: string[]
  streamAttached: boolean
  isStreamReady: boolean
}

export async function queryCameraPermissionState(): Promise<
  PermissionState | 'unknown' | 'unsupported'
> {
  if (!navigator.permissions?.query) return 'unsupported'
  try {
    const status = await navigator.permissions.query({ name: 'camera' as PermissionName })
    return status.state
  } catch {
    return 'unknown'
  }
}

export function collectCameraDiagnostics(input: {
  moduleId: string
  phase: string
  video: HTMLVideoElement | null
  stream: MediaStream | null
  isStreamReady: boolean
  getUserMediaError: { name: string; message: string } | null
}): CameraDiagnostics {
  const stream = input.stream
  const videoTracks = stream?.getVideoTracks() ?? []

  return {
    moduleId: input.moduleId,
    mediaDevicesAvailable: Boolean(navigator.mediaDevices?.getUserMedia),
    permissionState: 'unknown',
    phase: input.phase,
    getUserMediaError: input.getUserMediaError,
    videoReadyState: input.video?.readyState ?? null,
    videoWidth: input.video?.videoWidth ?? 0,
    videoHeight: input.video?.videoHeight ?? 0,
    activeVideoTracks: videoTracks.length,
    trackStates: videoTracks.map((track) => track.readyState),
    streamAttached: Boolean(input.video?.srcObject),
    isStreamReady: input.isStreamReady,
  }
}

/** V dev režimu vypíše diagnostiku kamery do konzole. */
export function logCameraDiagnostics(diagnostics: CameraDiagnostics, label: string): void {
  if (!import.meta.env.DEV) return
  console.info(`[camera:${diagnostics.moduleId}] ${label}`, diagnostics)
}

/** Zjistí, zda je element překrytý jiným prvkem (blokuje klik). */
export function isElementObstructed(element: HTMLElement | null): boolean {
  if (!element) return false
  const rect = element.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return true
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const topElement = document.elementFromPoint(centerX, centerY)
  return topElement != null && !element.contains(topElement) && topElement !== element
}
