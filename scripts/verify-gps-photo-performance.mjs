#!/usr/bin/env node
/**
 * Simulace GPS časů načítání pro fotodokumentaci (Android profil).
 * Spuštění: node scripts/verify-gps-photo-performance.mjs
 *
 * Výsledky odpovídají unit testům v src/lib/photos/gpsWatch.test.ts
 * a dokumentují očekávané chování na Androidu v Chrome.
 */
import { spawnSync } from 'node:child_process'

const SCENARIOS = [
  {
    name: 'Android – rychlá přesná poloha',
    firstFixMs: 900,
    fixes: [
      { atMs: 900, accuracy: 80 },
      { atMs: 2700, accuracy: 1.8 },
    ],
    expected: 'targetReachedMs ≈ 2700, focení nikdy neblokováno',
  },
  {
    name: 'Android – střední přesnost do 5 s',
    firstFixMs: 1200,
    fixes: [
      { atMs: 1200, accuracy: 120 },
      { atMs: 2800, accuracy: 35 },
      { atMs: 4100, accuracy: 12 },
    ],
    expected: 'settledMs = 5000, použita přesnost ±12 m',
  },
  {
    name: 'Android – pouze hrubá poloha',
    firstFixMs: 1500,
    fixes: [{ atMs: 1500, accuracy: 95 }],
    expected: 'settledMs = 5000, použita přesnost ±95 m',
  },
]

console.log('=== Fotodokumentace GPS – výkonnostní profil ===\n')
console.log(`Timeout čekání na nejlepší polohu: 5 s`)
console.log(`Cílová přesnost: ±2 m`)
console.log(`Focení: NIKDY neblokováno čekáním na GPS\n`)

for (const scenario of SCENARIOS) {
  console.log(`--- ${scenario.name} ---`)
  console.log(`  První fix: ${scenario.firstFixMs} ms`)
  for (const fix of scenario.fixes) {
    console.log(`  +${fix.atMs} ms → ±${fix.accuracy} m`)
  }
  console.log(`  Očekávaný výsledek: ${scenario.expected}`)
  console.log('')
}

console.log('Spouštím unit testy s mockovaným Geolocation API…\n')

const result = spawnSync('npx', ['vitest', 'run', 'src/lib/photos/gpsWatch.test.ts'], {
  stdio: 'inherit',
  shell: true,
})

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

console.log('\n=== Shrnutí pro Android testování ===')
console.log('1. Otevřete /fotky → záložka Focení na Android Chrome (HTTPS).')
console.log('2. Kamera se spustí ihned – tlačítko Vyfotit je aktivní bez čekání na GPS.')
console.log('3. V overlay uvidíte časy: První fix, Cíl/Ustáleno.')
console.log('4. Po 5 s bez ±2 m se použije nejlepší dostupná poloha a zobrazí se její přesnost.')
console.log('5. Uloží se: lat, lng, přesnost, ulice, obec, PSČ, stát, datum, čas, odkaz na mapu.')
