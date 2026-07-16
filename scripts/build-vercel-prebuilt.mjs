/**
 * Sestaví .vercel/output pro prebuilt deploy (static dist + api funkce).
 */
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { resolve, dirname, relative } from 'node:path'
import { execSync } from 'node:child_process'

const root = process.cwd()
const outRoot = resolve(root, '.vercel/output')
const staticDir = resolve(outRoot, 'static')
const configPath = resolve(outRoot, 'config.json')

console.log('Build: npm run build')
execSync('npm run build', { stdio: 'inherit', cwd: root })

rmSync(outRoot, { recursive: true, force: true })
mkdirSync(staticDir, { recursive: true })

cpSync(resolve(root, 'dist'), staticDir, { recursive: true })

const vercelJson = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8'))
const routes = []

for (const fn of ['api/ai-paper-form-extract.js', 'api/ai-polish-text.js']) {
  const abs = resolve(root, fn)
  if (!existsSync(abs)) continue
  const name = fn.replace(/^api\//, '').replace(/\.js$/, '')
  const funcDir = resolve(outRoot, 'functions', `api/${name}.func`)
  mkdirSync(funcDir, { recursive: true })
  cpSync(abs, resolve(funcDir, 'index.js'))
  routes.push({ src: `/api/${name}`, dest: `/api/${name}` })
}

routes.push({ handle: 'filesystem' })
for (const rw of vercelJson.rewrites ?? []) {
  if (rw.source.startsWith('/api/')) continue
  routes.push({ src: rw.source, dest: rw.destination })
}

const config = { version: 3, routes }
writeFileSync(configPath, JSON.stringify(config, null, 2))

console.log('OK: .vercel/output připraveno')
console.log(`Static: ${relative(root, staticDir)}`)
console.log(`Config: ${relative(root, configPath)}`)
