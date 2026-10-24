# Contributing

Run commands from the repository root.

## Development commands

Use a supported Node.js version and npm. `devEngines` specifies the Node versions required by the development tools; it does not restrict consumers of the library.

```sh
npm ci
npm test
npm run coverage
npm run build
npm run watch
npm run format
npm audit
```

`npm test` checks Oxlint/Oxfmt, builds the library and declarations, checks the source and API type fixtures, and runs the runtime tests. `npm run check` adds coverage to the same test run, so runtime tests run once. `npm run coverage` enforces 100% statements, branches, functions, and lines for all library source files and writes an HTML report to `coverage/index.html`. `npm run build` writes JavaScript and declarations to `dist/cjs` and `dist/esm`. Generated `dist/` files are ignored by Git and rebuilt by `prepack` before packaging. Watch mode rebuilds when source files change. Compiler errors are reported without stopping the watcher; fix the error and save to rebuild.

CI runs these checks on Node 22, 24, and 26 with React 18 and 19. It also runs the dependency audit, builds both examples, and checks package contents.

Both examples use the local library source and the root dependencies. Run these commands from the repository root:

```sh
npm ci
npm run examples       # http://127.0.0.1:3030
npm run examples:build # build both examples without starting the server
```

You can also start the examples with `node examples/run.js`. Open `/example-1/` or `/example-2/` from the server's index page. Refresh after editing to rebuild. The Node script uses the root esbuild dependency to bundle JSX, TypeScript, React, and CSS for the browser; the example directories need no package manifests or separate installs.

## Dependency audits

The library and examples share one dependency tree. CI requires `npm audit` to pass, including development dependencies. A `tmp` override keeps the release tool's older editor dependency on a patched version.

## Release a version

From a clean, up-to-date `main` branch, run:

```sh
npm run release
```

The script runs `np --no-publish && npm publish`. `np` reinstalls dependencies, runs `npm run check`, prompts for a version, bumps the version, and pushes the release commit and tag. The subsequent `npm publish` uses npm's own authentication flow for 2FA. Publishing requires npm 10+ and access to the package.

`prepack` rebuilds JavaScript and declarations before packaging. `prepublishOnly` runs tests, type checks, lint/format checks, and the full coverage gate before any direct `npm publish`. Use `npm pack --dry-run` to inspect package contents.

If npm publishing fails after `np` succeeds, the version commit and tag have already been pushed. Resolve the authentication or registry problem and retry `npm publish` for that version. Prereleases need an explicit dist-tag when publishing, for example `npm publish --tag beta`.
