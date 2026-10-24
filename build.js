const {
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  watch,
} = require('node:fs')
const { execFileSync } = require('node:child_process')
const { transformSync } = require('esbuild')

function build() {
  execFileSync(
    process.execPath,
    [
      'node_modules/typescript/bin/tsc',
      '--emitDeclarationOnly',
      'false',
      '--noEmitOnError',
      '--module',
      'preserve',
      '--moduleResolution',
      'bundler',
      '--jsx',
      'preserve',
    ],
    { stdio: 'inherit' },
  )
  const source = readFileSync('dist/kinfolk.jsx', 'utf8')
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
    writeFileSync(
      file.replace(/\.(mjs|cjs)$/, format === 'esm' ? '.d.mts' : '.d.cts'),
      readFileSync('dist/kinfolk.d.ts'),
    )
  }
  unlinkSync('dist/kinfolk.d.ts')
  unlinkSync('dist/kinfolk.jsx')
}

if (process.argv.includes('-w')) {
  const rebuild = () => {
    try {
      build()
    } catch (error) {
      console.error(error.message)
      console.error('Build failed; waiting for changes.')
    }
  }
  watch('src', rebuild)
  rebuild()
} else {
  build()
}
