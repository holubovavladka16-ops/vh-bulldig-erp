#!/usr/bin/env node
/** Ověří, zda produkce obsahuje aktuální build (v1.8.3+). */
const URL = process.env.PRODUCTION_URL || 'https://vh-bulldig-erp.vercel.app'
const MIN_VERSION = '1.8.3'

async function main() {
  const html = await fetch(URL).then((r) => r.text())
  const jsMatch = html.match(/assets\/index-[^"]+\.js/)
  if (!jsMatch) {
    console.error('Nenalezen JS bundle v HTML')
    process.exit(1)
  }
  const jsUrl = `${URL}/${jsMatch[0]}`
  const js = await fetch(jsUrl).then((r) => r.text())

  const removedMarkers = ['FotodokumentacePage', 'FotoCaptureScreen', 'FotoLokalizacniMapy', 'Specifikace modulu']
  const stillPresent = removedMarkers.filter((m) => js.includes(m))
  const versionMatch = js.match(/1\.8\.(\d+)/)

  console.log('URL:', URL)
  console.log('Bundle:', jsMatch[0])
  console.log('Verze v bundlu:', versionMatch ? `1.8.${versionMatch[1]}` : '(nenalezena)')
  console.log('Zrušený modul v bundlu:', stillPresent.join(', ') || '(žádné)')

  if (stillPresent.length > 0) {
    console.error('FAIL – v buildu jsou stopy odstraněného modulu.')
    process.exit(1)
  }

  if (versionMatch && Number(versionMatch[1]) >= Number(MIN_VERSION.split('.')[2])) {
    console.log(`OK – produkce běží na v1.8.${versionMatch[1]}+`)
    process.exit(0)
  }

  console.log('OK – build neobsahuje zrušený modul (verze může být starší než', MIN_VERSION + ')')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
