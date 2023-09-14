# Kinfolk

Atoms and selectors for React.

## Why?

Kinfolk is a more powerful context for React that allows:

- sharing state across wide parts of the application
- granular subscriptions to slices of state and derived state
- designed for use within libraries or applications

Kinfolk uses a series of simple techniques to ensure optimal re-renders. The granularity of atoms and selectors can be seen as an alternative to signals, because of how it allows to create granular fine tuned re-renders.

The benefits of Kinfolk over React Context are:

- Context is not recommended for storing many values, and subscribing to frequent changes
- <Context.Provider /> component re-renders the entire tree underneath on each state change
- Context does not allow granular or memoised subscriptions
- Only one <KinfolkProvider> is required per application while allowing multiple isolated atoms

## Optimal re-renders

Kinfolk has several layers that makes it performant:

- Selectors allow depending on a small slice of state and/or a computed value
- Using `useSyncExternalStore` bails from re-rendering if selected state didn't change
- Batched rerenders, that is setting state several times in the same tick will only re-render once
- The entire affected subtree is re-rendered only once
- Selectors are only re-computed if the input atoms or selectors were updated
- Selector can return objects or arrays and if the value is shallowly equal it won't cause a re-render
- useSetter is separate from useSelector to avoid re-rendering in components that only use useSetter

## Example

```js
import React from 'react'
import { Provider, atom, selector, useSelector, useSetter } from 'kinfolk'

const checkout = atom({
  order: [{ food: 'pizza' }, { food: 'burger' }],
  card: null,
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
  const c = useSelector(count)
  return <div>Items in basket: {c}</div>
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
  const setCheckoutState = useSetter(checkout)
  return (
    <input
      type='text'
      value={card}
      onChange={(e) => {
        setCheckoutState((c) => ({ ...c, card: e.target.value }))
      }}
    />
  )
}
```

## API

### `Provider`

Accepts an optional `store` prop. See the Advanced API below.

```js
<Provider />
<Provider store={createStore()} />
```

### `atom(initialState, { label })`

Create an atom. The `label` option is only used when viewing the contents of the store using `store.debug()`. Atom values are persisted throughout the lifetime of the application, use a setter if you want to clear the value of an atom.

```js
const counter = atom(0)
const users = atom([], { label: 'users' })
```

### `selector(selectorFn, { label, equal, persist = true })`

Create a selector that derives state from other atoms and selectors. Selectors cache their values to avoid recomputing the values upon each re-render. If the upstream dependencies did not change, the selector will return the memoised calculation. If all components that previously dependended on a selector were unmounted, the selector will persist it's memoisation cache. Set `persist` option to `false` to clear out the memoisation cache as soon as a selector is no longer used.

```js
const double = selector(() => counter() * 2)
const enhancedUsers = selector(() => users().map(withFullName), {
  label: 'enhancedUsers',
  persist: false,
})
```

Selectors can also take arguments and compute multiple memoised values (aka selector families).

```js
const multiple = selector((n) => counter() * n)
const calc = useSelector(() => multiple(1) + multiple(2) + multiple(3))
```

### `useSelector(selectorFn, dependencies, { label, equal })`

Read an atom or selector inside a React component and subscribe to the value. Only if the value computed by the `selectorFn` has changed will the component re-render. Note: when comparing the value the default `equal` function is used but can by customised. The default `equal` function will not only compare strict object equality, but will also compare objects shallowly (every key/value in both objects equals) and compare arrays shallowly (every item in the array in both objects equals).

```js
const count = useSelector(counter, [])
const doubleCount = useSelector(double, [])
const tripleCount = useSelector(() => counter() * 3, [], {
  label: 'tripleCount',
})
```

### `useSetter(atomRef)`

Allows updating an atom with a setter that takes a value or an update function.

```js
const set = useSetter(counter)
set(1)
set((c) => c + 1)
```

### `useReducer()`

Allows updating an atom with a reducer.

```js
const calculator = (state, action) => {
  if (action === 'inc') return state + 1
  if (action === 'dec') return state + 1
  return state
}
const dispatch = useReducer(counter, calculator)
dispatch('inc')
dispatch('dec')
```

## Advanced API

### `createStore()`

By default a store is automatically created in the Provider. Creating a store and passing it in explicitly allows to:

- read and modify it outside of React's render tree with `get(atomRef)` and `set(atomRef, update)`
- allows viewing the contents of the store using `debug()` method
- allows sharing it between application and libraries and even cross-depend on those atoms

```js
const store = createStore()
<Provider store={store} />
const val = store.get(counter)
store.set(counter, val + 1)
store.set(counter, c => c + 1)
store.debug() // returns an object with all values of all atoms and selectors
```

### `createContext()`

Create an isolated context with it's own Provider, for use within libraries. Note that it is still possible to share the store if the same store instance is provided to application and library Providers.

```js
const { atom, selector, Provider, useSelector, useSetter, useReducer } =
  createContext()
```

## Alternatives

- redux - global stores are not ideal for large apps, React is modular and so is Kinfolk
- tiny-atom - same flaws as redux, current implementation not fully compatible with React 18
- zustand - neat and simple and also offers subscribing to slices of state
- recoil - inspiration for Kinfolk, large API surface area, bigger codebase than React
- jotai - feature rich, supports async atoms and selectors

## Caution

While the ideas for this library are old and sourced from a lot of inspiration in the React ecosystem, given the library is new at this point and given the certain amount of complexity in semantics of React's concurrent rendering and the `useSyncExternalStore` hook below are some things to be aware of.

- Like with React itself, only one copy of Kinfolk should ideally be present in a project because of how atom and selector references are kept in the Kinfolk module's scope.

- Kinfolk is tracking selector dependencies during the `getSnapshot()` call of the `useSyncExternalStore`. In principle this shold be no different than what something like Recoil is doing, the behaviour is at this time a little experimental and could present some edge cases where this might not work as expected, especially in concurrent rendering.

- Due to the usage of the `useSyncExternalStore` hook, React will de-opt from concurrent rendering and will restart the rendering and re-render the whole app synchronously every time an atom is updated, at least according [to this discussion of useSyncExternalStore](https://github.com/reactwg/react-18/discussions/86).
