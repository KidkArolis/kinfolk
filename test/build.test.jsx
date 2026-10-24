// @vitest-environment node
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, test, vi } from 'vitest'

test('watch mode recovers from initial and subsequent TypeScript errors', async () => {
  const fixture = mkdtempSync(path.join(tmpdir(), 'kinfolk-watch-'))
  mkdirSync(path.join(fixture, 'src'))
  copyFileSync('build.js', path.join(fixture, 'build.js'))
  copyFileSync('tsconfig.json', path.join(fixture, 'tsconfig.json'))
  symlinkSync(
    path.resolve('node_modules'),
    path.join(fixture, 'node_modules'),
    'dir',
  )
  const source = path.join(fixture, 'src/kinfolk.tsx')
  const writeSource = (value) =>
    writeFileSync(source, `export const value: number = ${value}\n`)
  writeSource("'broken'")
  const child = spawn(process.execPath, ['build.js', '-w'], {
    cwd: fixture,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', (data) => {
    output += data
  })
  child.stderr.on('data', (data) => {
    output += data
  })
  const waitFor = (assertion) => vi.waitFor(assertion, { timeout: 10000 })
  const expectBuild = (value) => {
    for (const file of ['dist/cjs/kinfolk.cjs', 'dist/esm/kinfolk.mjs']) {
      expect(readFileSync(path.join(fixture, file), 'utf8')).toContain(
        `value = ${value}`,
      )
    }
    for (const file of ['dist/cjs/kinfolk.d.cts', 'dist/esm/kinfolk.d.mts']) {
      expect(readFileSync(path.join(fixture, file), 'utf8')).toContain(
        'value: number',
      )
    }
  }
  try {
    await waitFor(() =>
      expect(output).toContain('Build failed; waiting for changes.'),
    )
    expect(child.exitCode).toBeNull()
    writeSource(1)
    await waitFor(() => expectBuild(1))
    output = ''
    writeSource("'broken again'")
    await waitFor(() =>
      expect(output).toContain('Build failed; waiting for changes.'),
    )
    expectBuild(1)
    expect(child.exitCode).toBeNull()
    writeSource(2)
    await waitFor(() => expectBuild(2))
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit')
      child.kill()
      await exited
    }
    rmSync(fixture, { recursive: true, force: true })
  }
}, 30000)
