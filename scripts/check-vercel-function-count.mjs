#!/usr/bin/env node
/**
 * Počítá soubory, které Vercel mapuje na Serverless Functions (stejné pravidlo jako Hobby limit 12).
 * Počítají se všechny .js/.ts soubory v api/ kromě _prefixed složek.
 */
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function listFunctionFiles(dir, base = 'api') {
  const out = []
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('_')) continue
    const full = join(dir, entry)
    const rel = join(base, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      out.push(...listFunctionFiles(full, rel))
      continue
    }
    if (/\.(js|ts)$/.test(entry)) out.push(rel)
  }
  return out
}

const files = listFunctionFiles('api')
console.log(`Serverless Functions: ${files.length}`)
for (const f of files.sort()) console.log(`  - ${f}`)
if (files.length > 12) {
  console.error('FAIL: překročen limit 12 funkcí na Hobby plánu')
  process.exit(1)
}
console.log('OK: počet funkcí je v limitu Hobby plánu (max 12)')
