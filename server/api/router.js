import geocode from './geocode.js'
import aiPolishText from './ai-polish-text.js'
import aiFormCheckExtract from './ai-form-check-extract.js'
import aiPaperFormExtract from './ai-paper-form-extract.js'
import adminEnvKeys from './admin-env-keys.js'
import adminRuntimeDiagnostics from './admin-runtime-diagnostics.js'
import adminApplyFakturovacMigrations from './admin-apply-fakturovac-migrations.js'
import adminApplyPdf8Migrations from './admin-apply-pdf8-migrations.js'
import adminApplyFormCheckMigrations from './admin-apply-form-check-migrations.js'
import adminApplyInvoiceableItemsSeed from './admin-apply-invoiceable-items-seed.js'

/** Mapování veřejných /api/* cest na existující handlery (beze změny URL). */
const ROUTES = {
  geocode,
  'ai-polish-text': aiPolishText,
  'ai-form-check-extract': aiFormCheckExtract,
  'ai-paper-form-extract': aiPaperFormExtract,
  'admin-env-keys': adminEnvKeys,
  'admin-runtime-diagnostics': adminRuntimeDiagnostics,
  'admin-apply-fakturovac-migrations': adminApplyFakturovacMigrations,
  'admin-apply-pdf8-migrations': adminApplyPdf8Migrations,
  'admin-apply-form-check-migrations': adminApplyFormCheckMigrations,
  'admin-apply-invoiceable-items-seed': adminApplyInvoiceableItemsSeed,
}

export function resolveApiPath(segments) {
  if (!segments) return ''
  return Array.isArray(segments) ? segments.join('/') : String(segments)
}

export function getApiHandler(path) {
  return ROUTES[path] ?? null
}
