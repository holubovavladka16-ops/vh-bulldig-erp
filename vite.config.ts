import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import type { Connect } from 'vite'
import pkg from './package.json' with { type: 'json' }

function resolveBuildId(): string {
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)
  }
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'local'
  }
}

const buildId = resolveBuildId()
const buildTime = new Date().toISOString()

function geocodeDevMiddleware(): Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (!req.url?.startsWith('/api/geocode')) {
      next()
      return
    }

    const url = new URL(req.url, 'http://localhost')
    const query = url.searchParams.get('q')?.trim()
    if (!query) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Chybí parametr q' }))
      return
    }

    try {
      const nominatim = new URL('https://nominatim.openstreetmap.org/search')
      nominatim.searchParams.set('q', query)
      nominatim.searchParams.set('format', 'json')
      nominatim.searchParams.set('limit', '1')
      nominatim.searchParams.set('countrycodes', 'cz')

      const response = await fetch(nominatim.toString(), {
        headers: {
          'User-Agent': 'VH-Bulldig-ERP/2.0 (local-dev)',
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        res.statusCode = 502
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: `Nominatim HTTP ${response.status}` }))
        return
      }

      const data = (await response.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>
      const hit = data[0]
      if (!hit?.lat || !hit?.lon) {
        res.statusCode = 404
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Adresa nenalezena' }))
        return
      }

      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(
        JSON.stringify({
          lat: Number(hit.lat),
          lng: Number(hit.lon),
          display_name: hit.display_name?.trim() || query,
        })
      )
    } catch (error) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Geokódování selhalo',
        })
      )
    }
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'geocode-api-dev',
      configureServer(server) {
        server.middlewares.use(geocodeDevMiddleware())
      },
      configurePreviewServer(server) {
        server.middlewares.use(geocodeDevMiddleware())
      },
    },
    {
      name: 'inject-app-version-meta',
      transformIndexHtml(html) {
        return html.replace(
          '</head>',
          `    <meta name="app-version" content="${pkg.version}" />\n    <meta name="app-build" content="${buildId}" />\n    <meta name="app-build-time" content="${buildTime}" />\n  </head>`
        )
      },
    },
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_ID__: JSON.stringify(buildId),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  envPrefix: ['VITE_', 'SUPABASE_'],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
  },
})
