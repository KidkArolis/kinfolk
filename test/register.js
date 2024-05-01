/* eslint-disable import/no-commonjs */
const { transformSync } = require('@swc/core')
const pirates = require('pirates')
const fs = require('fs')
const path = require('path')
const swcrc = JSON.parse(fs.readFileSync(path.join(__dirname, '../.swc-cjs')))

pirates.addHook(
  (code) => {
    const result = transformSync(code, swcrc)
    return result.code
  },
  { exts: ['.js'], ignoreNodeModules: false },
)
