import { build } from 'vite'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

// Use the project's existing Vite compiler for TS; run real simulation code
// with Node's test runner, without a browser or extra test dependencies.
const outDir = await mkdtemp(join(tmpdir(), 'frostline-tests-'))
try {
  await build({
    configFile: false,
    logLevel: 'warn',
    ssr: { noExternal: true },
    build: {
      ssr: 'tests/save.test.ts',
      outDir,
      emptyOutDir: true,
      rollupOptions: { output: { entryFileNames: 'save.test.mjs' } },
    },
  })
  const result = spawnSync(process.execPath, ['--test', join(outDir, 'save.test.mjs')], { stdio: 'inherit' })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} finally {
  await rm(outDir, { recursive: true, force: true })
}
