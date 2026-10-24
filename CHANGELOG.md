# Unreleased

- Run both examples from the root dependencies with a Node script; remove their separate package manifests, lockfiles, and Jetpack dependency.
- Avoid retaining nonpersistent selectors from suspended or discarded React renders, and dispose unused dynamic dependencies.
- Compare atom and selector values consistently with `Object.is`, including `NaN` and signed zero.
- Compare own enumerable string and symbol keys in shallow object results.
- Restore TypeScript inference for actionless reducer dispatch functions.

- Release through `np --no-publish && npm publish` with package-build and full-check lifecycle hooks.

- Upgrade dependencies in the library and both examples; remove vulnerable test-tooling dependencies.
- Use Vitest and V8 coverage, esbuild, Oxlint, and Oxfmt throughout development.
- Convert the library to strict TypeScript and publish declarations for CommonJS and ESM.
- Declare React 18/19 peer support and update Node requirements for current development tools.
- Enforce 100% library coverage and add CI for supported Node and React versions.
- Fix persisted-selector subscriptions after remount and dependency tracking across selector-family arguments.
- Fix duplicate falsy and array values in store debug output.
- Document the API, store lifetime, selector caching, and current limitations.

# 0.7.4

- Upgrade deps to fix security alerts.

# 0.7.3

- Upgrade deps to fix security alerts.

# 0.7.2

- Upgrade deps to fix security alerts.

# 0.7.1

- Remove .swcrc to fix importing kinfolk as esm package in certain bundler configurations

# 0.7.0

- Upgrade deps to fix security alerts.

# 0.6.0

- Add support for Node.js native ESM mode - build kinfolk with .cjs and .mjs and add exports

# 0.5.1

- Upgrade dependencies of the examples.

# 0.5.0

- Upgrade deps to fix security alerts.

# 0.4.0

- Handle errors in selectors without breaking global internal kinfolk state. (https://github.com/KidkArolis/kinfolk/pull/2)

# 0.3.0

- Upgrade all dependencies.

# 0.2.0

- Added documentation to the README

# 0.1.1

- Sorting out the publish step.

# 0.1.0

- All working nicely! See README and code for all the features.
