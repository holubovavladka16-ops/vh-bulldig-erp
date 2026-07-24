import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const jsPath = resolve('dist/assets/index-Cv-jctKA.js')
const jsContent = readFileSync(jsPath, 'utf8')

console.log('=== CHECKING BUILT JAVASCRIPT FOR SUPABASE CONFIG ===\n')

const supabaseUrl = 'khhalcjgvqoyskkjlkyg.supabase.co'
const anonKey = 'sb_publishable_Fgamr8h6D47nHIEsZd2_oQ_7m-DOUkU'

if (jsContent.includes(supabaseUrl)) {
  console.log('✅ Supabase URL found in built JS')
} else {
  console.log('❌ Supabase URL NOT found in built JS')
}

if (jsContent.includes(anonKey)) {
  console.log('✅ Supabase Anon Key found in built JS')
} else {
  console.log('❌ Supabase Anon Key NOT found in built JS')
}

console.log('\nSearching for VITE_SUPABASE_URL pattern...')
const urlMatches = jsContent.match(/VITE_SUPABASE_URL/g)
console.log('Matches:', urlMatches ? urlMatches.length : 0)

console.log('\nSearching for import.meta.env.VITE_SUPABASE_URL...')
const envMatches = jsContent.match(/import\.meta\.env\.VITE_SUPABASE_URL/g)
console.log('Matches:', envMatches ? envMatches.length : 0)

console.log('\nFirst 500 characters of built JS:')
console.log(jsContent.substring(0, 500))
