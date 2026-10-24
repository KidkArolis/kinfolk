const { mkdirSync, readFileSync, writeFileSync, watch } = require('node:fs')
const { transformSync } = require('esbuild')

function build() {
  const source = readFileSync('src/kinfolk.jsx', 'utf8')
  for (const [format, file] of [
    ['esm', 'dist/esm/kinfolk.mjs'],
    ['cjs', 'dist/cjs/kinfolk.cjs'],
  ]) {
    mkdirSync(`dist/${format}`, { recursive: true })
    const { code } = transformSync(source, {
      loader: 'jsx',
      format,
      target: 'es2020',
    })
    writeFileSync(file, code)
  }
}

build()
if (process.argv.includes('-w')) watch('src', build)
