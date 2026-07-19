#!/usr/bin/env node
/** Ověří, zda produkce obsahuje nový build fotodokumentace (v1.8.1+). */
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

  const markers = ['Specifikace modulu', 'FotoLokalizacniMapy', 'Enterprise modul', '1.8.1']
  const found = markers.filter((m) => js.includes(m))
  console.log('URL:', URL)
  console.log('Bundle:', jsMatch[0])
  console.log('Nalezeno:', found.join(', ') || '(nic)')

  if (found.length >= 2) {
    console.log('OK – nový build je na produkci.')
    process.exit(0)
  }
  console.error('STARÝ BUILD – deploy neproběhl. Nastavte VERCEL secrets nebo spusťte deploy z Vercel dashboardu.')
  process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
