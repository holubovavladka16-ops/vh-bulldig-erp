export const GPS_FOTOARCHIV_MODULE_ID = 'gps-fotoarchiv' as const
export const GPS_FOTOARCHIV_PATH = '/gps-fotoarchiv' as const

export const GPS_FOTOARCHIV_LABEL = 'Fotodokumentace s GPS'

/** Maximální přípustná přesnost GPS pro uložení fotografie (metry). */
export const GPS_FOTOARCHIV_MAX_ACCURACY_METERS = 3

export const GPS_FOTOARCHIV_VIEWS = ['capture', 'gallery', 'map'] as const
export type GpsFotoarchivView = (typeof GPS_FOTOARCHIV_VIEWS)[number]

export const GPS_FOTOARCHIV_VIEW_LABELS: Record<GpsFotoarchivView, string> = {
  capture: 'Pořízení',
  gallery: 'Galerie',
  map: 'Mapa',
}
