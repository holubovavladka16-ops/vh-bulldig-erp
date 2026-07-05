import os from 'node:os'

/** Primární IPv4 adresa v lokální síti (Wi‑Fi / Ethernet), ne loopback. */
export function getPrimaryLanIPv4() {
  const nets = os.networkInterfaces()
  const candidates = []

  for (const entries of Object.values(nets)) {
    for (const net of entries ?? []) {
      if (net.family !== 'IPv4' && net.family !== 4) continue
      if (net.internal) continue
      candidates.push({ address: net.address, name: net.name ?? '' })
    }
  }

  const wifi = candidates.find((c) => /wi-?fi|wlan|wireless/i.test(c.name))
  if (wifi) return wifi.address

  const ethernet = candidates.find((c) => /eth|ethernet|en\d/i.test(c.name))
  if (ethernet) return ethernet.address

  return candidates[0]?.address ?? null
}

export function printNetworkAccessInfo({
  lanIp,
  appPort = 5173,
  apiPort = 54321,
  loginPath = '/prihlaseni',
} = {}) {
  const ip = lanIp ?? getPrimaryLanIPv4()

  console.log('')
  console.log('=== PŘÍSTUP Z POČÍTAČE ===')
  console.log(`Aplikace:         http://localhost:${appPort}${loginPath}`)
  console.log(`API:              http://127.0.0.1:${apiPort}`)

  if (!ip) {
    console.log('')
    console.log('=== MOBILNÍ TESTOVÁNÍ ===')
    console.log('LAN IP se nepodařilo zjistit – spusťte ipconfig a použijte IPv4 adresu Wi‑Fi adaptéru.')
    console.log('')
    return ip
  }

  console.log('')
  console.log('=== MOBILNÍ TESTOVÁNÍ (stejná Wi‑Fi) ===')
  console.log(`IP počítače:      ${ip}`)
  console.log(`Aplikace (mobil): http://${ip}:${appPort}${loginPath}`)
  console.log(`API (mobil):      http://${ip}:${apiPort}`)
  console.log('')
  console.log('Telefon a PC musí být ve stejné síti. Povolte porty 5173 a 54321 ve Windows Firewall.')
  console.log('')

  return ip
}
