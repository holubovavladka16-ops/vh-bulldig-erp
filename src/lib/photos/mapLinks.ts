function resolveCoords(
  lat: number | null | undefined,
  lng: number | null | undefined
): { lat: number; lng: number } | null {
  if (lat == null || lng == null) return null
  return { lat, lng }
}

export function getMapyCzUrl(lat: number | null | undefined, lng: number | null | undefined): string {
  const coords = resolveCoords(lat, lng)
  if (!coords) return '#'
  return `https://mapy.cz/zakladni?x=${coords.lng}&y=${coords.lat}&z=18`
}

export function getGoogleMapsUrl(lat: number | null | undefined, lng: number | null | undefined): string {
  const coords = resolveCoords(lat, lng)
  if (!coords) return '#'
  return `https://www.google.com/maps?q=${coords.lat},${coords.lng}`
}

export function getStreetViewUrl(lat: number | null | undefined, lng: number | null | undefined): string {
  const coords = resolveCoords(lat, lng)
  if (!coords) return '#'
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${coords.lat},${coords.lng}`
}

export function getOpenStreetMapEmbedUrl(lat: number | null | undefined, lng: number | null | undefined): string {
  const coords = resolveCoords(lat, lng)
  if (!coords) return '#'
  const delta = 0.004
  const bbox = `${coords.lng - delta},${coords.lat - delta},${coords.lng + delta},${coords.lat + delta}`
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${coords.lat}%2C${coords.lng}`
}

export function getStreetViewEmbedUrl(lat: number | null | undefined, lng: number | null | undefined): string {
  const coords = resolveCoords(lat, lng)
  if (!coords) return '#'
  return `https://maps.google.com/maps?q=&layer=c&cbll=${coords.lat},${coords.lng}&cbp=11,0,0,0,0&output=svembed`
}

export function getOpenStreetMapUrl(lat: number | null | undefined, lng: number | null | undefined): string {
  const coords = resolveCoords(lat, lng)
  if (!coords) return '#'
  return `https://www.openstreetmap.org/?mlat=${coords.lat}&mlon=${coords.lng}#map=17/${coords.lat}/${coords.lng}`
}

/** Statický náhled mapy pro tisk / PDF (OpenStreetMap static map služba). */
export function getStaticMapImageUrl(
  lat: number | null | undefined,
  lng: number | null | undefined,
  width = 640,
  height = 200
): string {
  const coords = resolveCoords(lat, lng)
  if (!coords) return ''
  const params = new URLSearchParams({
    center: `${coords.lat},${coords.lng}`,
    zoom: '16',
    size: `${width}x${height}`,
    markers: `${coords.lat},${coords.lng},red-pushpin`,
  })
  return `https://staticmap.openstreetmap.de/staticmap.php?${params.toString()}`
}
