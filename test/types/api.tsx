import React from 'react'
import {
  atom,
  selector,
  createStore,
  createContext,
  useSelector,
  useSetter,
  useReducer,
  Provider,
  type Atom,
  type Selector,
} from '../../src/kinfolk'
const counter: Atom<number> = atom(0)
const double: Selector<number> = selector(() => counter() * 2)
const times = selector((factor: number) => counter() * factor)
const store = createStore()
const count: number = store.get(counter)
const doubled: number = store.get(double)
const multiplied: number = store.get(times, 3)
store.set(counter, count + doubled + multiplied)
store.set(counter, (n) => n + 1)
// @ts-expect-error Atom values cannot change type.
store.set(counter, 'wrong')
// @ts-expect-error Selector values are read-only.
store.set(double, 2)
// @ts-expect-error Family arguments are required.
store.get(times)
// @ts-expect-error Family arguments have a concrete type.
store.get(times, 'wrong')
// @ts-expect-error Atoms cannot be assigned to a different value type.
const invalid: Atom<string> = counter
void invalid
function Component() {
  const value: number = useSelector(counter)
  const derived: number = useSelector(double)
  const family: number = useSelector(() => times(2), { deps: [] })
  // @ts-expect-error Dependencies belong in the options object.
  useSelector(counter, [])
  // @ts-expect-error The legacy third options argument is no longer supported.
  useSelector(counter, undefined, { equal: Object.is })
  const set = useSetter(counter)
  set((n) => n + value + derived + family)
  // @ts-expect-error Setters preserve the atom's type.
  set('wrong')
  // @ts-expect-error Selectors cannot have setters.
  useSetter(double)
  // @ts-expect-error Families must be wrapped to supply their arguments.
  useSelector(times)
  const dispatch = useReducer(
    counter,
    (state, action: 'inc' | 'dec') => state + (action === 'inc' ? 1 : -1),
  )
  dispatch('inc')
  // @ts-expect-error Reducer actions retain their type.
  dispatch('invalid')
  return <Provider store={store}>{value}</Provider>
}
const isolated = createContext()
const isolatedValue: number = isolated.useSelector(counter)
void isolatedValue
void Component
