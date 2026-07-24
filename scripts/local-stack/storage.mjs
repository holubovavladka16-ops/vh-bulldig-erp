import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { writeCorsHeaders } from './cors.mjs'

const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
  '.svg': 'image/svg+xml',
}

function guessContentType(objectPath) {
  const ext = objectPath.slice(objectPath.lastIndexOf('.')).toLowerCase()
  return MIME_TYPES[ext] ?? 'application/octet-stream'
}

export function createStorageHandler(storageRoot) {
  mkdirSync(storageRoot, { recursive: true })

  function storagePath(bucket, objectPath) {
    return join(storageRoot, bucket, objectPath)
  }

  async function readRawBody(req) {
    const chunks = []
    for await (const chunk of req) {
      chunks.push(chunk)
    }
    return Buffer.concat(chunks)
  }

  function sendJson(res, status, payload) {
    const body = JSON.stringify(payload)
    writeCorsHeaders(res, status, { 'Content-Type': 'application/json' })
    res.end(body)
  }

  async function handleStorage(req, res, url) {
    if (req.method === 'OPTIONS') {
      writeCorsHeaders(res, 204)
      res.end()
      return
    }

    const uploadMatch = url.pathname.match(/^\/storage\/v1\/object\/([^/]+)\/(.+)$/)
    if ((req.method === 'POST' || req.method === 'PUT') && uploadMatch) {
      const [, bucket, objectPath] = uploadMatch
      const body = await readRawBody(req)
      const fullPath = storagePath(bucket, decodeURIComponent(objectPath))
      mkdirSync(dirname(fullPath), { recursive: true })
      writeFileSync(fullPath, body)
      sendJson(res, 200, { Key: `${bucket}/${objectPath}` })
      return
    }

    const publicMatch = url.pathname.match(/^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
    if (req.method === 'GET' && publicMatch) {
      const [, bucket, objectPath] = publicMatch
      const fullPath = storagePath(bucket, decodeURIComponent(objectPath))
      if (!existsSync(fullPath)) {
        sendJson(res, 404, { message: 'Object not found', path: url.pathname })
        return
      }
      writeCorsHeaders(res, 200, { 'Content-Type': guessContentType(objectPath) })
      createReadStream(fullPath).pipe(res)
      return
    }

    sendJson(res, 404, { message: 'Storage route not found', path: url.pathname })
  }

  return { handleStorage, storagePath }
}
