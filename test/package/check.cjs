const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} = require('node:fs')
const { tmpdir } = require('node:os')
const path = require('node:path')

const root = path.resolve(__dirname, '../..')
const npmCli = process.env.npm_execpath
if (!npmCli) throw new Error('Run this check with npm run test:package')
const reactVersion = require('react/package.json').version
const reactDomVersion = require('react-dom/package.json').version
const reactMajor = reactVersion.split('.')[0]
const fixture = mkdtempSync(path.join(tmpdir(), 'kinfolk-package-'))

try {
  const result = execFileSync(
    process.execPath,
    [npmCli, 'pack', '--json', '--pack-destination', fixture],
    {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    },
  )
  const [packed] = JSON.parse(result)
  assert.deepEqual(
    packed.files.map((file) => file.path).sort(),
    [
      'LICENSE',
      'README.md',
      'dist/cjs/kinfolk.cjs',
      'dist/cjs/kinfolk.d.cts',
      'dist/esm/kinfolk.d.mts',
      'dist/esm/kinfolk.mjs',
      'package.json',
    ].sort(),
  )
  writeFileSync(
    path.join(fixture, 'package.json'),
    JSON.stringify({
      name: 'kinfolk-package-check',
      private: true,
      dependencies: {
        kinfolk: `file:${path.join(fixture, packed.filename)}`,
        react: reactVersion,
        'react-dom': reactDomVersion,
        '@types/react': `^${reactMajor}`,
        '@types/react-dom': `^${reactMajor}`,
      },
    }),
  )
  execFileSync(
    process.execPath,
    [
      npmCli,
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--package-lock=false',
    ],
    {
      cwd: fixture,
      stdio: 'inherit',
    },
  )
  const license = readFileSync(
    path.join(fixture, 'node_modules/kinfolk/LICENSE'),
    'utf8',
  )
  assert.ok(license.includes('Permission to use, copy, modify'))
  for (const name of ['runtime.cjs', 'require.cjs', 'import.mjs']) {
    copyFileSync(path.join(__dirname, name), path.join(fixture, name))
  }
  for (const name of ['package.cts', 'package.mts']) {
    copyFileSync(path.join(root, 'test/types', name), path.join(fixture, name))
  }
  writeFileSync(
    path.join(fixture, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        noUncheckedIndexedAccess: true,
        noEmit: true,
        skipLibCheck: true,
      },
      files: ['package.cts', 'package.mts'],
    }),
  )
  execFileSync(process.execPath, ['require.cjs'], {
    cwd: fixture,
    stdio: 'inherit',
  })
  execFileSync(process.execPath, ['import.mjs'], {
    cwd: fixture,
    stdio: 'inherit',
  })
  execFileSync(
    process.execPath,
    [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', fixture],
    { cwd: fixture, stdio: 'inherit' },
  )
  console.log(
    `Packed package passed CommonJS, ESM, SSR, license, and type checks with React ${reactVersion}.`,
  )
} finally {
  rmSync(fixture, { recursive: true, force: true })
}
