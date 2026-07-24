/**
 * Při Vercel buildu zapíše GEMINI_API_KEY do runtime souboru pro serverless API.
 * Klíč se neukládá do gitu – pouze do api/.runtime-env.json (gitignored).
 */
import { writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const key = process.env.GEMINI_API_KEY?.trim() ?? ''
const outPath = resolve('api/.runtime-env.json')

if (key) {
  writeFileSync(outPath, JSON.stringify({ GEMINI_API_KEY: key }), 'utf8')
  console.log('inject-gemini-runtime: GEMINI_API_KEY připraven pro serverless API')
} else if (existsSync(outPath)) {
  unlinkSync(outPath)
  console.log('inject-gemini-runtime: GEMINI_API_KEY chybí, runtime soubor odstraněn')
} else {
  console.log('inject-gemini-runtime: GEMINI_API_KEY chybí (API použije process.env)')
}
