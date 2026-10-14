import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

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

// the page itself must always be revalidated; hashed assets can cache forever
const noCacheHtml = { 'Cache-Control': 'no-cache' }

export default defineConfig({
  plugins: [react(), versionFile()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  server: { host: true, headers: noCacheHtml },
  preview: { headers: noCacheHtml },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
})
