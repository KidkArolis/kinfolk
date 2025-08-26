const neostandard = require('neostandard')
const reactHooks = require('eslint-plugin-react-hooks')

// Function to patch the neostandard config
function superneostandard(neoConfig) {
  const config = neostandard(neoConfig)

  // allow jsx in js files! that's all we're doing!
  const jsxIndex = config.findIndex((c) => c && c.name === 'neostandard/jsx')
  const jsxCfg = config[jsxIndex]
  config[jsxIndex] = {
    ...jsxCfg,
    name: 'neostandard/jsx',
    files: ['**/*.{js,jsx,ts,tsx}'],
    ignores: [], // remove ignore patterns that excluded .js
    languageOptions: {
      ...(jsxCfg.languageOptions || {}),
      parserOptions: {
        ...((jsxCfg.languageOptions && jsxCfg.languageOptions.parserOptions) ||
          {}),
        ecmaFeatures: { jsx: true },
      },
    },
  }

  // Add react-hooks rules on top for a bit of extra spice
  config.push({
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  })

  return config
}

// Build + patch neostandard config
module.exports = superneostandard({
  noStyle: true,
  ignores: ['dist/**/*', ...neostandard.resolveIgnoresFromGitignore()],
})
