import {
  atom,
  selector,
  createStore,
  useSetter,
  useReducer,
  type Atom,
  type Selector,
} from '../../src/kinfolk'

const count = atom(0)
const store = createStore()
// @ts-expect-error Writable atoms cannot widen to allow incompatible writes.
const mixed: Atom<number | string> = count
// @ts-expect-error Explicit store generics cannot widen a writable atom.
store.set<number | string>(count, 'oops')
// @ts-expect-error Writable atoms cannot narrow to hide possible values.
const narrow: Atom<number> = atom<number | string>(0)

const flexible = atom<number | string>(0)
store.set(flexible, 'allowed')
store.set(flexible, 2)
const readOnly: Selector<number | string> = selector(() => count())
const value: number = store.get(count)
void mixed
void narrow
void readOnly
void value

function Component() {
  // @ts-expect-error Setter generics cannot widen a writable atom.
  useSetter<number | string>(count)
  // @ts-expect-error Reducer generics cannot widen a writable atom.
  useReducer<number | string>(count, () => 'oops')
  const set = useSetter(flexible)
  set('allowed')
  set(3)
  return null
}
void Component
