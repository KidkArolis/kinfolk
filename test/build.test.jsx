// @vitest-environment node
import { execFileSync, spawn } from 'node:child_process'
import { once } from 'node:events'
import { createRequire } from 'node:module'
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
import { pathToFileURL } from 'node:url'
import { expect, onTestFinished, test, vi } from 'vitest'

function createFixture() {
  const fixture = mkdtempSync(path.join(tmpdir(), 'kinfolk-watch-'))
  onTestFinished(() => rmSync(fixture, { recursive: true, force: true }))
  mkdirSync(path.join(fixture, 'src'))
  copyFileSync('build.js', path.join(fixture, 'build.js'))
  copyFileSync('tsconfig.json', path.join(fixture, 'tsconfig.json'))
  symlinkSync(
    path.resolve('node_modules'),
    path.join(fixture, 'node_modules'),
    'dir',
  )
  return fixture
}

test('JavaScript and declarations use the same checked source despite a later edit', async () => {
  const fixture = createFixture()
  writeFileSync(
    path.join(fixture, 'src/kinfolk.tsx'),
    `import React from 'react'
export const value: number = 1
export const view = <span>{value}</span>
`,
  )
  const edit = path.join(fixture, 'edit-after-check.cjs')
  writeFileSync(
    edit,
    `const childProcess = require('node:child_process')
const { writeFileSync } = require('node:fs')
const compile = childProcess.execFileSync
childProcess.execFileSync = (...args) => {
  const result = compile(...args)
  writeFileSync('src/kinfolk.tsx', "export const value: number = 'broken'\\n")
  return result
}
`,
  )
  execFileSync(process.execPath, ['--require', edit, 'build.js'], {
    cwd: fixture,
    stdio: 'pipe',
  })
  const cjs = createRequire(import.meta.url)(
    path.join(fixture, 'dist/cjs/kinfolk.cjs'),
  )
  const esm = await import(
    pathToFileURL(path.join(fixture, 'dist/esm/kinfolk.mjs')).href
  )
  for (const exports of [cjs, esm]) {
    expect(exports.value).toBe(1)
    expect(exports.view.type).toBe('span')
    expect(exports.view.props.children).toBe(1)
  }
  for (const file of ['dist/cjs/kinfolk.d.cts', 'dist/esm/kinfolk.d.mts']) {
    expect(readFileSync(path.join(fixture, file), 'utf8')).toContain(
      'value: number',
    )
  }
})

test('watch mode recovers from initial and subsequent TypeScript errors', async () => {
  const fixture = createFixture()
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
  }
}, 30000)
