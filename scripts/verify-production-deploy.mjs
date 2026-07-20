#!/usr/bin/env node
/** Ověří, zda produkce obsahuje aktuální build (v1.8.2+ bez modulu fotodokumentace). */
const URL = process.env.PRODUCTION_URL || 'https://vh-bulldig-erp.vercel.app'

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
  const versionMatch = js.match(/1\.8\.[2-9]|1\.9\.|2\./)

  console.log('URL:', URL)
  console.log('Bundle:', jsMatch[0])
  console.log('Odstraněné moduly stále v bundlu:', stillPresent.join(', ') || '(žádné)')

  if (stillPresent.length === 0) {
    console.log('OK – modul fotodokumentace není v produkčním buildu.')
    process.exit(0)
  }

  if (versionMatch) {
    console.log('Verze:', versionMatch[0])
  }

  console.error('STARÝ BUILD – modul fotodokumentace stále v produkci. Spusťte deploy z Vercel dashboardu.')
  process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
