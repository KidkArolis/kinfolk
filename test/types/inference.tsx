import {
  atom,
  selector,
  createStore,
  useSelector,
  type Atom,
  type Selector,
} from '../../src/kinfolk'

const count = atom(2)
const times = selector((factor = 2) => count() * factor)
const optional = selector((factor?: number) => count() * (factor ?? 2))
const required = selector((factor: number) => count() * factor)
const plain = selector(() => count())
const store = createStore()
const defaulted: number = store.get(times)
const explicit: number = store.get(times, 3)
const omitted: number = store.get(optional)
const undefinedArg: number = store.get(optional, undefined)
const callable: number = times()
const called: number = times(3)
const annotated: Selector<number, number> = required
// @ts-expect-error Required arguments cannot be omitted.
required()
// @ts-expect-error Required family reads need their argument.
store.get(required)
// @ts-expect-error Family arguments retain their types.
store.get(times, 'wrong')
// @ts-expect-error Argumentless selectors do not accept arbitrary arguments.
store.get(plain, 3)
// @ts-expect-error Selectors accept at most one argument.
selector((a: number, b: number) => a + b)

const choice = Math.random() > 0.5 ? atom(0) : atom('hello')
const read: string | number = store.get(choice)
// @ts-expect-error A union read cannot be narrowed to one possible type.
const narrow: number = store.get(choice)
// @ts-expect-error Reading a union does not make writing through it safe.
store.set(choice, 3)
// @ts-expect-error Writable atoms remain invariant.
const widened: Atom<string | number> = count

function Component() {
  const selected: number = useSelector(times)
  const maybe: number = useSelector(optional)
  const union: string | number = useSelector(choice, {
    equal: (previous, next) => {
      const before: string | number = previous
      const after: string | number = next
      return Object.is(before, after)
    },
  })
  useSelector(count, {
    equal: (previous, next) => previous.toFixed() === next.toFixed(),
  })
  // @ts-expect-error A union selection cannot be narrowed to one possible type.
  const wrong: number = useSelector(choice)
  // @ts-expect-error Required family arguments must still be supplied.
  useSelector(required)
  void selected
  void maybe
  void union
  void wrong
  return null
}
void defaulted
void explicit
void omitted
void undefinedArg
void callable
void called
void annotated
void read
void narrow
void widened
void Component

store.clearCache(times)
store.clearCache(times, 2)
store.clearCache(times, undefined)
store.clearCache(required)
store.clearCache(required, 2)
store.clearCache(plain)
// @ts-expect-error Atoms do not have selector caches.
store.clearCache(count)
// @ts-expect-error Cache arguments retain the selector's argument type.
store.clearCache(required, 'wrong')
// @ts-expect-error Argumentless selectors reject arbitrary cache arguments.
store.clearCache(plain, 2)
// @ts-expect-error Cache clearing accepts at most one argument key.
store.clearCache(times, 2, 3)
