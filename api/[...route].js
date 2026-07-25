/**
 * Jediný Vercel Serverless Function entrypoint – směruje /api/* na handlery v server/api/.
 * Zachovává veřejné URL (/api/geocode, /api/ai-polish-text, …).
 */
export const runtime = 'nodejs'

import { getApiHandler, resolveApiPath } from '../server/api/router.js'

export default async function handler(req, res) {
  const path = resolveApiPath(req.query.route)
  const routeHandler = getApiHandler(path)

  if (!routeHandler) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.status(404).json({ error: 'Not found' })
  }

  return routeHandler(req, res)
}
