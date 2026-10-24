const path = require('node:path')
const esbuild = require('esbuild')

const buildOnly = process.argv.includes('--build')
const options = {
  absWorkingDir: path.resolve(__dirname, '..'),
  entryPoints: {
    'example-1/dist/index': path.join(__dirname, 'example-1/index.js'),
    'example-2/dist/index': path.join(__dirname, 'example-2/index.js'),
  },
  outdir: __dirname,
  bundle: true,
  loader: { '.js': 'jsx' },
  jsx: 'automatic',
  alias: {
    react: path.dirname(require.resolve('react/package.json')),
    'react-dom': path.dirname(require.resolve('react-dom/package.json')),
  },
  minify: buildOnly,
  sourcemap: !buildOnly,
  logLevel: 'info',
}

async function run() {
  if (buildOnly) {
    await esbuild.build(options)
    return
  }

  const context = await esbuild.context(options)
  try {
    const { port } = await context.serve({
      servedir: __dirname,
      host: '127.0.0.1',
      port: 3030,
    })
    console.log(`Examples: http://127.0.0.1:${port}/`)
    console.log('Refresh the browser after editing to rebuild.')
  } catch (error) {
    await context.dispose()
    throw error
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
