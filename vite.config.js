import { readFileSync, readdirSync } from 'fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import esbuild from 'esbuild'
import { resolve } from 'path'

const adapterEntry = resolve(__dirname, 'src/adapters/flare/flareAdapter.cjs')

function adapterExportNames(source) {
  const marker = 'module.exports = {'
  const start = source.lastIndexOf(marker)
  if (start < 0) return []
  let depth = 0
  let end = -1
  for (let i = start + marker.length - 1; i < source.length; i += 1) {
    const ch = source[i]
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  const body = source.slice(start + marker.length, end)
  return [...body.matchAll(/^\s*([A-Za-z_$][\w$]*)\s*(?:,|:)/gm)].map((match) => match[1])
}

// Vite serves project .cjs files as raw CommonJS. The dev page imports named
// bindings, so bundle the pure adapter and re-export those names. Production
// builds already convert this file through Rollup.
function flareAdapterDevEsm() {
  let cached = null
  const adapterDir = resolve(__dirname, 'src/adapters/flare')
  return {
    name: 'flare-adapter-dev-esm',
    apply: 'serve',
    enforce: 'pre',
    async load(id) {
      const clean = id.split('?')[0].replace(/\\/g, '/')
      if (!clean.endsWith('/src/adapters/flare/flareAdapter.cjs')) return null
      for (const file of readdirSync(adapterDir)) {
        if (file.endsWith('.cjs')) this.addWatchFile(resolve(adapterDir, file))
      }
      if (!cached) {
        cached = esbuild.build({
          entryPoints: [adapterEntry],
          bundle: true,
          format: 'esm',
          platform: 'neutral',
          write: false,
          absWorkingDir: __dirname,
          logLevel: 'silent',
        }).then((result) => {
          const names = adapterExportNames(readFileSync(adapterEntry, 'utf8'))
          if (!names.includes('applyTileToProjectIndex')) {
            throw new Error('flareAdapter.cjs named exports were not detected')
          }
          let code = result.outputFiles[0].text
          const matched = code.match(/export default (require_[A-Za-z0-9_]+)\(\);/)
          if (!matched) throw new Error('esbuild did not emit an adapter default export')
          const local = '__flareAdapter'
          const lines = names.map((name) => `export const ${name} = ${local}.${name};`)
          code = code.replace(
            matched[0],
            `const ${local} = ${matched[1]}();\n${lines.join('\n')}\nexport default ${local};`
          )
          return code
        }).catch((error) => {
          cached = null
          throw error
        })
      }
      return cached
    },
  }
}

export default defineConfig({
  plugins: [react(), flareAdapterDevEsm()],
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  },
  server: {
    port: 5173
  },
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
