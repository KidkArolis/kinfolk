import { atom, selector, createStore, type Atom } from 'kinfolk'
const count: Atom<number> = atom(0)
const times = selector((n: number) => count() * n)
const store = createStore()
const value: number = store.get(times, 2)
store.set(count, value)
// @ts-expect-error Published declarations reject invalid values.
store.set(count, 'wrong')
// @ts-expect-error Published declarations reject selector writes.
store.set(times, 2)
