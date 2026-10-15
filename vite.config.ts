import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
// @ts-expect-error plain-JS server module, shared with the Vercel function
import { handleCloud, memoryStore } from './api/_cloud.js'

// Every build gets an id. The game polls version.json (uncached) and reloads
// itself when a newer build is live, so phones never stay on a stale copy.
const BUILD_ID = Date.now().toString(36)

function versionFile(): Plugin {
  return {
    name: 'frostline-version',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: BUILD_ID }) })
    },
  }
}

// Online saves in dev: the same handler as api/save.js, backed by memory (lost on restart)
function devCloud(): Plugin {
  const store = memoryStore()
  return {
    name: 'frostline-dev-cloud',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/save', (req, res) => {
        let raw = ''
        req.on('data', (c) => (raw += c))
        req.on('end', async () => {
          let body = null
          try {
            body = JSON.parse(raw)
          } catch {
            // handled as a bad request
          }
          const { status, json } = await handleCloud(body, req.socket.remoteAddress ?? 'dev', store)
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(json))
        })
      })
    },
  }
}

// the page itself must always be revalidated; hashed assets can cache forever
const noCacheHtml = { 'Cache-Control': 'no-cache' }

export default defineConfig({
  plugins: [react(), versionFile(), devCloud()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  server: { host: true, headers: noCacheHtml },
  preview: { headers: noCacheHtml },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
})
