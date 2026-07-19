export function getMapyCzUrl(lat: number, lng: number): string {
  return `https://mapy.cz/zakladni?x=${lng}&y=${lat}&z=18`
}

/** Interaktivní mapa Mapy.cz se špendlíkem na souřadnicích (pro iframe / nové okno). */
export function getMapyCzEmbedUrl(lat: number, lng: number, zoom = 18): string {
  const id = `${lng},${lat}`
  return `https://mapy.com/zakladni?x=${lng}&y=${lat}&z=${zoom}&source=coor&id=${encodeURIComponent(id)}`
}

/** Odkaz pro otevření mapy v aplikaci Mapy.com (mobil / desktop). */
export function getMapyCzShowMapUrl(lat: number, lng: number, zoom = 18): string {
  return `https://mapy.com/fnc/v1/showmap?mapset=basic&center=${lng},${lat}&zoom=${zoom}&marker=true`
}

export function getGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`
}

export function getStreetViewUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`
}

export function getOpenStreetMapEmbedUrl(lat: number, lng: number): string {
  const delta = 0.004
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${lat}%2C${lng}`
}

export function getStreetViewEmbedUrl(lat: number, lng: number): string {
  return `https://maps.google.com/maps?q=&layer=c&cbll=${lat},${lng}&cbp=11,0,0,0,0&output=svembed`
}

export function getOpenStreetMapUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`
}

/** Statický náhled mapy pro tisk / PDF (OpenStreetMap static map služba). */
export function getStaticMapImageUrl(lat: number, lng: number, width = 640, height = 200): string {
  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: '16',
    size: `${width}x${height}`,
    markers: `${lat},${lng},red-pushpin`,
  })
  return `https://staticmap.openstreetmap.de/staticmap.php?${params.toString()}`
}
