/**
 * Kompletní regenerační test – build, auth, DB, moduly.
 * Spusťte: npm run verify-full-regression
 */
import { spawnSync } from 'node:child_process'

const steps = [
  { name: 'TypeScript + Vite build', cmd: 'npm', args: ['run', 'build'] },
  { name: 'ESLint', cmd: 'npm', args: ['run', 'lint'] },
  { name: 'Auth systém', cmd: 'npm', args: ['run', 'verify-auth-system'] },
  { name: 'Cloud login', cmd: 'npm', args: ['run', 'verify-cloud-login'] },
  { name: 'Cloud E2E', cmd: 'npm', args: ['run', 'verify-cloud-e2e'] },
  { name: 'Datum narození', cmd: 'npm', args: ['run', 'verify-birth-date'] },
]

console.log('=== KOMPLETNÍ REGENERAČNÍ TEST ===\n')

const failed = []

for (const step of steps) {
  process.stdout.write(`▶ ${step.name}… `)
  const result = spawnSync(step.cmd, step.args, {
    stdio: 'pipe',
    shell: true,
    encoding: 'utf8',
  })
  if (result.status === 0) {
    console.log('OK')
  } else {
    console.log('FAIL')
    failed.push(step.name)
    if (result.stdout) console.error(result.stdout.slice(-2000))
    if (result.stderr) console.error(result.stderr.slice(-2000))
  }
}

console.log('')
if (failed.length === 0) {
  console.log(`=== REGENERACE OK (${steps.length}/${steps.length}) ===`)
  process.exit(0)
}

console.log(`=== SELHALO ${failed.length}/${steps.length}: ${failed.join(', ')} ===`)
process.exit(1)
