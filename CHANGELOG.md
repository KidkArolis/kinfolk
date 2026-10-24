# Unreleased

- **Breaking:** `useSelector` now takes one options object as its second argument. Move dependency arrays to `options.deps`; changes to `equal` and `label` now take effect.
- Providers now follow changes to their `store` prop. Keep supplied stores stable unless you intend to switch state.
- Infer defaulted and optional selector arguments, and allow reads that return a union of atom value types.
- Add `store.clearCache` to remove one selector result or all of its cached arguments.

- Add built-in TypeScript support, with inferred types for atoms, selectors, setters, and reducers.
- Support React 18 and 19, with both CommonJS and ESM imports.
- Fix missed updates after remounting components or using selectors with arguments, plus edge cases in value comparisons and debug output.
- Speed up repeated selector reads and fix a memory leak during rendering.
- Update dependencies and bring library test coverage to 100%.

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
