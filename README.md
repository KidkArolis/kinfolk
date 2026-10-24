# Kinfolk

Atoms and selectors for React. Share state through a Provider and subscribe to individual values or derived values with `useSelector`.

Kinfolk keeps the store in React context and notifies subscribers when atoms change. A component using `useSelector` re-renders when its selected value changes. Components using only `useSetter` or `useReducer` do not subscribe to state changes.

## Install

```sh
npm install kinfolk react
```

React 18 and 19 are supported. It exports both CommonJS and ESM entry points with TypeScript declarations. React is a peer dependency.

## Example

```tsx
import { Provider, atom, selector, useSelector, useSetter } from 'kinfolk'

const checkout = atom({
  order: [{ food: 'pizza' }, { food: 'burger' }],
  card: '',
})
const count = selector(() => checkout().order.length)

export function App() {
  return (
    <Provider>
      <Header />
      <OrderDetails />
      <CardDetails />
    </Provider>
  )
}

function Header() {
  const items = useSelector(count)
  return <div>Items in basket: {items}</div>
}

function OrderDetails() {
  const order = useSelector(() => checkout().order, [])
  return (
    <div>
      {order.map((item) => (
        <div key={item.food}>{item.food}</div>
      ))}
    </div>
  )
}

function CardDetails() {
  const card = useSelector(() => checkout().card, [])
  const setCheckout = useSetter(checkout)
  return (
    <input
      value={card}
      onChange={(event) => {
        setCheckout((current) => ({ ...current, card: event.target.value }))
      }}
    />
  )
}
```

Calling an atom or selector reference directly reads its value only during a selector calculation. In a component, read it through `useSelector`. Outside React, use `store.get`.

## API

### `atom(initialState, options?)`

Creates a callable reference to a state value. `options.label` names the atom in `store.debug()`. Each store initializes the atom lazily and retains its value for that store's lifetime, including when components unmount.

```ts
const counter = atom(0)
const users = atom<{ id: string; name: string }[]>([], { label: 'users' })
```

TypeScript infers the value type from the initial value. Supply a type argument for empty arrays or values that will later take another form, such as `atom<string | null>(null)`.

### `selector(selectorFn, options?)`

Creates a synchronous derived value. Kinfolk records atoms and selectors read during the calculation, then recomputes when one of those inputs changes. Selectors can read other selectors. Avoid side effects or state updates inside a selector.

Options:

- `label` names the selector in `store.debug()`.
- `equal(previous, next)` determines whether to reuse the previous result. The default comparator uses `Object.is` for primitive values and shallow object/array entries. `NaN` equals itself, while `0` and `-0` differ. Object comparisons include own enumerable string and symbol keys, and distinguish a missing key from a key with an `undefined` value. Inherited and nonenumerable properties are ignored. It does not deeply compare nested values, Dates, or Maps.
- `persist` defaults to `true`. Set it to `false` to discard the selector state when its last listener and dependent selector are removed.

```ts
const double = selector(() => counter() * 2)
const names = selector(() => users().map((user) => user.name), {
  label: 'names',
  persist: false,
})
```

A selector can take one argument, with a separate cache entry for each argument. Argument keys use Map identity: two different objects create different entries. Persisted selector caches have no size limit or eviction policy.

```tsx
const multiple = selector((factor: number) => counter() * factor)

function Total() {
  const total = useSelector(() => multiple(2) + multiple(3), [])
  return <div>{total}</div>
}
```

### `Provider`

Wrap components using Kinfolk hooks in their context's Provider. It creates a store unless you supply one. The Provider captures the store on its first render; changing the `store` prop does not replace it. Remount the Provider to switch stores.

```tsx
<Provider>
  <App />
</Provider>

<Provider store={store}>
  <App />
</Provider>
```

Hooks throw an error outside their matching Provider. Separate Providers have separate state unless they receive the same store.

### `useSelector(selectorFnOrRef, dependencies?, options?)`

Reads and subscribes to an atom, an argumentless selector, or a callback that reads references. Selector families must be wrapped in a callback that supplies the argument.

```tsx
const count = useSelector(counter)
const doubled = useSelector(double)
const multiplied = useSelector(() => multiple(factor), [factor])
```

For callback selectors, list captured component values in `dependencies`, as with `useCallback`. An empty list retains the callback across renders. Omitting the list refreshes it on each render. When passing a reference directly, Kinfolk tracks that reference's identity and ignores the dependency list.

The `label` and `equal` options follow `selector`. They are captured when the callback is memoized. To change them, change the callback dependencies; for a direct reference, change the reference. The internal hook selector is always nonpersistent and is removed on unsubscribe.

Kinfolk uses `useSyncExternalStore`. Returning the same selected result avoids a state-driven re-render. React still controls renders caused by parents, props, and other hooks, and controls batching.

### `useSetter(atomRef)`

Returns a setter accepting a value or an updater function. Use immutable updates for objects and arrays. Returning the same value does not notify subscribers.

```tsx
const setCount = useSetter(counter)
setCount(1)
setCount((current) => current + 1)
```

Function-valued atoms follow React's updater convention. Wrap the new function in an updater to store it, for example `setHandler(() => nextHandler)`.

### `useReducer(atomRef, reducer)`

Returns a dispatch function that applies `reducer(state, action)` to the atom. TypeScript infers the atom value type and the reducer's action type. Selectors cannot be updated through setters or reducers.

```tsx
const dispatch = useReducer(counter, (state, action: 'inc' | 'dec') => {
  return action === 'inc' ? state + 1 : state - 1
})
dispatch('inc')
dispatch('dec')
```

## Stores and isolated contexts

### `createStore()`

Creates a store for use outside React or for sharing between Providers. `get` and `set` use the same references as the hooks. Store updates notify mounted subscribers.

```ts
const store = createStore()
store.get(counter)
store.get(multiple, 5)
store.set(counter, 10)
store.set(counter, (current) => current + 1)
```

`store.debug()` returns the values of initialized atoms keyed by label. Its `__selectors` property contains selector memoization Maps keyed by selector label. Each Map entry has a `value` and tracked `inputs`. Duplicate labels produce an array of values or Maps. Generated labels are for debugging and can change. Reserve `__selectors` for the debug output.

The exposed `atomStates`, `atomMetas`, and memoization details are debugging internals, not a stable API. A TypeScript `Store` type is exported, along with `Atom`, `Selector`, `Update`, `AtomOptions`, `SelectorOptions`, `UseSelectorOptions`, and `ProviderProps`.

### `createContext()`

Creates a separate Provider and hooks, useful for libraries. References are shared at module scope, while each Provider owns its store. Contexts can share values and cross-read references when their Providers receive the same store.

```ts
const library = createContext()
// library.atom, library.selector, library.Provider,
// library.useSelector, library.useSetter, library.useReducer
```

## Limits

- Selectors must run synchronously. Reads after an `await` are outside Kinfolk's dependency tracking. Async loading and Suspense integration are not provided.
- `useSelector` does not provide a server snapshot to `useSyncExternalStore`, so server rendering components that call it is not supported.
- Use one copy of Kinfolk in an application. References from a different copy of the module are not recognized.
- Selector dependency cycles are not supported.
- Changing mutable objects in place bypasses change detection. Replace changed objects and arrays.

## Releases

From a clean, up-to-date `main` branch, run:

```sh
npm run release
```

The script runs `np --no-publish && npm publish`. `np` reinstalls dependencies, runs `npm run check`, prompts for a version, bumps the version, and pushes the release commit and tag. The subsequent `npm publish` uses npm's own authentication flow for 2FA. Publishing requires npm 10+ and access to the package.

`prepack` rebuilds JavaScript and declarations before packaging. `prepublishOnly` runs tests, type checks, lint/format checks, and the full coverage gate before any direct `npm publish`. Use `npm pack --dry-run` to inspect package contents.

If npm publishing fails after `np` succeeds, the version commit and tag have already been pushed. Resolve the authentication or registry problem and retry `npm publish` for that version. Prereleases need an explicit dist-tag when publishing, for example `npm publish --tag beta`.

### Dependency audits

The full dependency audits for the library and both examples are clean. CI requires all three audits to pass, including development dependencies. A `tmp` override keeps the release tool's older editor dependency on a patched version.

## Development

Use a supported Node.js version and npm.

```sh
npm ci
npm test
npm run coverage
npm run build
npm run watch
npm run format
npm audit
```

`npm test` checks Oxlint/Oxfmt, builds the library and declarations, checks the source and API type fixtures, and runs the runtime tests. `npm run coverage` enforces 100% statements, branches, functions, and lines for all library source files and writes an HTML report to `coverage/index.html`. `npm run build` writes JavaScript and declarations to `dist/cjs` and `dist/esm`. Watch mode rebuilds when source files change.

CI runs these checks on Node 22, 24, and 26 with React 18 and 19. It also audits and builds both examples and checks package contents.

Each example installs its own dependencies and uses the local library source:

```sh
cd examples/example-1 # or examples/example-2
npm ci
npm start           # http://localhost:3030
npm run build
npm audit
```
