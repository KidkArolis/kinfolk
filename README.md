# kinfolk

Atoms and selectors for React.

## Why?

Kinfolk will help:

- share state across wide parts of the application
- memoize values computed from state

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

The benefits of this over tiny-atom are:

- React concurrent mode compatible, using useSyncExternalStore
- Allows using many atoms, more inline with React’s component model compared to the “global store” approach
- Better ergonomics for local / componetised state
- Removes the need for reselect - memoisation is built in

The benefits of this over React Context are:

Context is not great/recommended for storing many values, and subscribing to frequent changes
<Context.Provider /> component re-renders the entire tree underneath on each state change
Context does not allow granular, memoised subscriptions
Easier to get going without having to invent custom wrapper logic around context

But you know, not sure. React team is kind of pushing towards the server+client fusion with React Server Components. The state, the context, data fetching kind of melts away, you async/await on data and pass it to components as props. And of course we’re also looking to move to Relay and GraphQL for data fetching and that might remove lots of state (Note: relay internally still has to manage global state/cache!). I believe there’s still a case to be made for client side state in many scenarios and so having “the best” approach is appealing.

Alternatives:

- redux - meh, global store is not ideal for large apps
- tiny-atom - same flaw as redux, docs out of date, oops, and also see above for more flaws
- zustand - neat, simple, also offers subscribing to slices of state
- recoil - huge (bigger codebase than React? :thinking:), a bit complicated and scary
- jotai - feature rich, but at the cost of api succintness IMO
