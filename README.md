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
  const order = useSelector(() => checkout().order, { deps: [] })
  return (
    <div>
      {order.map((item) => (
        <div key={item.food}>{item.food}</div>
      ))}
    </div>
  )
}

function CardDetails() {
  const card = useSelector(() => checkout().card, { deps: [] })
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

TypeScript infers the value type from the initial value. Writable atoms keep that exact type, so an `Atom<number>` cannot be widened to `Atom<number | string>` and then written with a string. Supply a type argument for empty arrays or values that will later take another form, such as `atom<string | null>(null)`.

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

A selector can take one argument, with a separate cache entry for each argument. TypeScript infers required, optional, and defaulted arguments from the callback. For example, `selector((factor = 2) => counter() * factor)` can be called with no argument or with a number. Argument keys use Map identity: two different objects create different entries. Persisted selector caches have no size limit or eviction policy.

```tsx
const multiple = selector((factor: number) => counter() * factor)

function Total() {
  const total = useSelector(() => multiple(2) + multiple(3), { deps: [] })
  return <div>{total}</div>
}
```

### `Provider`

Wrap components using Kinfolk hooks in their context's Provider. Without a `store` prop, it uses its own stable store. Changing the supplied store switches reads, subscriptions, setters, and reducers to that store. Removing the prop restores the Provider's own store.

```tsx
<Provider>
  <App />
</Provider>

<Provider store={store}>
  <App />
</Provider>
```

Hooks throw an error outside their matching Provider. Separate Providers have separate state unless they receive the same store.

### `useSelector(selectorFnOrRef, options?)`

Reads and subscribes to an atom, an argumentless selector, or a callback that reads references. Selector families must be wrapped in a callback that supplies the argument.

```tsx
const count = useSelector(counter)
const doubled = useSelector(double)
const multiplied = useSelector(() => multiple(factor), { deps: [factor] })
```

For callback selectors, list captured component values in `options.deps`, as with `useCallback`. An empty list retains the callback across renders. Omitting the list refreshes it on each render. When passing a reference directly, Kinfolk tracks that reference's identity and ignores `deps`.

The `label` and `equal` options follow `selector` and take effect when they change, including for direct references. The internal hook selector is always nonpersistent and is removed on unsubscribe.

Returning the same selected result avoids a state-driven re-render.

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

`store.debug()` returns initialized atom values keyed by label, with selector caches under `__selectors`. Duplicate labels are grouped into arrays. Reserve `__selectors` for the debug output.

Generated labels, cache contents, and the exposed `atomStates` and `atomMetas` maps are debugging internals, not a stable API.

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

## Development

Install the root dependencies, run the checks, and start the examples:

```sh
npm ci
npm run check
npm run examples
```

Open [the examples](http://127.0.0.1:3030/) and choose one. Refresh after editing to rebuild.

See [CONTRIBUTING.md](CONTRIBUTING.md) for development commands and release instructions.
