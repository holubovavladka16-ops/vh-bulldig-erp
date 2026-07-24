import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { writeDevelopmentEnv, removeDevelopmentEnv } from './env-files.mjs'
import { printNetworkAccessInfo } from './network.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const ENV_FILE = resolve(ROOT, '.local-stack/runtime.env.json')

if (!existsSync(ENV_FILE)) {
  console.error('FAIL: Lokální stack neběží. Spusťte nejdřív: npm run dev:local:stack')
  process.exit(1)
}

const runtime = JSON.parse(readFileSync(ENV_FILE, 'utf8'))
writeDevelopmentEnv(runtime)
printNetworkAccessInfo({ lanIp: runtime.lanIp, apiPort: runtime.gatewayPort ?? 54321 })

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const child = spawn(npmCmd, ['run', 'dev'], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: true,
})

child.on('exit', (code) => {
  removeDevelopmentEnv()
  process.exit(code ?? 0)
})

process.on('SIGINT', () => {
  removeDevelopmentEnv()
  process.exit(0)
})
