import {
  atom,
  selector,
  createStore,
  useReducer,
  useSelector,
  type Atom,
} from 'kinfolk'
const count: Atom<number> = atom(0)
const times = selector((n: number) => count() * n)
const store = createStore()
const value: number = store.get(times, 2)
store.set(count, value)
// @ts-expect-error Published declarations reject invalid values.
store.set(count, 'wrong')
// @ts-expect-error Published declarations reject selector writes.
store.set(times, 2)

function Component() {
  const increment = useReducer(count, (state) => state + 1)
  increment()
  // @ts-expect-error Actionless reducers reject unexpected actions.
  increment('wrong')
  const dispatch = useReducer(count, (state, amount: number) => state + amount)
  dispatch(2)
  // @ts-expect-error Actionful reducers still require an action.
  dispatch()
  return null
}
void Component

// @ts-expect-error Published writable atoms cannot widen to permit invalid writes.
const mixed: Atom<number | string> = count
void mixed

const defaulted = selector((factor = 2) => count() * factor)
const inferred: number = store.get(defaulted)
const explicit: number = store.get(defaulted, 3)
const choice = Math.random() > 0.5 ? atom(0) : atom('hello')
const union: number | string = store.get(choice)
// @ts-expect-error Published declarations preserve defaulted argument types.
store.get(defaulted, 'wrong')
void inferred
void explicit
void union

store.clearCache(defaulted)
store.clearCache(defaulted, 2)
store.clearCache(defaulted, undefined)
// @ts-expect-error Published cache clearing rejects atoms.
store.clearCache(count)
// @ts-expect-error Published cache clearing retains argument types.
store.clearCache(defaulted, 'wrong')

function HookForms() {
  const a: number = useSelector(count)
  const b: number = useSelector(count, [])
  const c: number = useSelector(count, {
    equal: (previous, next) => previous.toFixed() === next.toFixed(),
  })
  const d: number = useSelector(count, [], {
    equal: (previous, next) => previous.toFixed() === next.toFixed(),
  })
  void a
  void b
  void c
  void d
  return null
}
void HookForms
