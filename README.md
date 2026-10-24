# Kinfolk

Atoms and selectors for React. Share state through a Provider and subscribe to individual values or derived values with `useSelector`.

## Why?

Kinfolk adds granular subscriptions to shared React state. It lets you:

- Share state across distant parts of an application.
- Subscribe to individual atoms, slices of state, or derived values.
- Keep many independent atoms under one Provider, without creating a context for each piece of state.
- Build libraries with isolated contexts, while allowing the application and library to share a store when needed.

With React Context, changing the provider's value re-renders every component that reads that context, even if the particular field it uses has not changed. If the component holding the provider's state also recreates its children, its own render can cascade through the subtree. Memoization or stable children can avoid some parent-driven renders, but context consumers still receive the changed context value. See [React's context caveats](https://react.dev/reference/react/useContext#caveats).

Kinfolk keeps the store stable in React context and subscribes components to their selected values. In the checkout example below, editing the card field can leave the basket count unchanged, so the component reading that count does not need to re-render because of that update.

### How updates stay granular

- Selectors cache derived values and recalculate when their inputs change.
- Shallow equality lets selectors reuse equivalent object and array results.
- `useSyncExternalStore` skips a state-driven re-render when the selected result is unchanged.
- Components using only `useSetter` or `useReducer` do not subscribe to state changes.

React still controls batching and renders caused by parents, props, and other hooks.

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

Reducers without an action parameter produce a dispatch function that takes no arguments:

```tsx
const increment = useReducer(counter, (state) => state + 1)
increment()
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

Nonpersistent selectors appear in the debug registry only while subscribed or used by an active selector. Discarded renders do not retain these selectors in the registry. Registry iteration order is not guaranteed.

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

The library and examples share one dependency tree. CI requires `npm audit` to pass, including development dependencies. A `tmp` override keeps the release tool's older editor dependency on a patched version.

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

CI runs these checks on Node 22, 24, and 26 with React 18 and 19. It also runs the dependency audit, builds both examples, and checks package contents.

Both examples use the local library source and the root dependencies. Run these commands from the repository root:

```sh
npm ci
npm run examples       # http://127.0.0.1:3030
npm run examples:build # build both examples without starting the server
```

You can also start the examples with `node examples/run.js`. Open `/example-1/` or `/example-2/` from the server's index page. Refresh after editing to rebuild. The Node script uses the root esbuild dependency to bundle JSX, TypeScript, React, and CSS for the browser; the example directories need no package manifests or separate installs.
