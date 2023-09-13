# kinfolk

Atoms and selectors for React.

## Why?

Kinfolk is a more powerful context for React that allows:

- sharing state across wide parts of the application
- depending on slices of state and derived state
- memoising the values computed from state
- creating multiple atoms and selectors that form a granular dependency graph

The granularity of atoms and selectors can also be seen as an alternative to signals, because it allows to create granular fine tuned re-renders.

The benefits of this over React Context are:

- Context is not recommended for storing many values, and subscribing to frequent changes
- <Context.Provider /> component re-renders the entire tree underneath on each state change
- Context does not allow granular, memoised subscriptions

## Why is it performant?

Kinfolk has several layers that makes it a performant approach:

- Using `useSyncExternalStore` bails from re-rendering if state didn't change
- Batched rerenders
- Only affected components are rerendered
- The entire affected subtree is rerendered only once
- Selector computations are cached based on referential equality of inputs
- Shallow equals allows returning shallowly equal objects and arrays
- Selectors allow depending on a small slice of state and/or a computed value
- useSetter is separate from useSelector to avoid re-rendering on state changes

## API

```js
import {
  Provider,
  atom,
  selector,
  useSelector,
  useSetter,
  useReducer,
} from 'kinfolk'

const store = atom({
  status: 'loading',
  filters: [],
  sort: [],
  data: null,
  edits: null,
  search: '',
  selection: {},
})

// derived state
// - recomputes when upstream dependencies change
// - memoises the computed value
// - supports single values, or "families" like the last
//   example where each value of "n" will create a new memoised value
const status = selector(() => store().status)
const search = selector(() => store().search)
const filters = selector(() => store().filters)
const nthFilter = selector((n) => filters()[n])

function Tables() {
  // only re-renders if store() was updated and then status is a different string
  const status = useSelector(() => status(), [])

  // not a good example, will always re-render whenever store changes
  const { data, edits } = useSelector(
    () => ({ data: store().data, edits: store().edits }),
    [],
  )

  // a better example, will only re-render if specifically the first
  // filter changed regardless of other updates in the store
  const firstFilter = useSelector(() => nthFilter(0), [])

  return <div />
}

function FilterBlock() {
  // subscribe to only the slice of the state you care about
  const filters = useSelector(filters)

  // equivalent in this case
  const filters = useSelector(() => store().filters)

  // some localised way to update the value
  const updateFilters = useSetter(store, (nextFilters) => (state) => {
    return { ...state, filters: nextFilters }
  })

  return <button onClick={() => updateFilters(['foo'])}>Update</button>
}
```

## Alternatives

- redux - global store is not ideal for large apps, React is modular and so is Kinfolk
- tiny-atom - same flaws as redux, outdated implementation that's not React 18 compatible
- zustand - neat and simple and also offers subscribing to slices of state
- recoil - inspiration for Kinfolk, bigger codebase than React with large API surface
- jotai - feature rich, but at the cost of API surface area / clarity
