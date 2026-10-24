import { atom, selector, createStore, useReducer, type Atom } from 'kinfolk'
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
