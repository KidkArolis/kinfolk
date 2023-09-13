const watch = process.argv[2] === '-w'
const w = watch ? ' -w' : ''

;(async function () {
  const { execa } = await import('execa')
  const sh = (...args) => execa(...args, { stdio: 'inherit', shell: true })

  await sh('rm -rf dist')
  await sh('mkdir -p dist')

  const swc = './node_modules/.bin/swc'
  await sh(`${swc}${w} --no-swcrc src -d dist/esm --config-file=./.swc-esm`)
  await sh(`${swc}${w} --no-swcrc src -d dist/cjs --config-file=./.swc-cjs`)

  const prettier = './node_modules/.bin/prettier'
  await sh(`${prettier} --write ./dist`)
})()
