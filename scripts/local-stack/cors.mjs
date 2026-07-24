export const CORS_ALLOW_HEADERS =
  'authorization, x-client-info, apikey, content-type, prefer, x-supabase-api-version, accept-profile, content-profile'

export const CORS_ALLOW_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS'

export function writeCorsHeaders(res, status = 200, extra = {}) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': CORS_ALLOW_METHODS,
    'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS,
    ...extra,
  })
}
