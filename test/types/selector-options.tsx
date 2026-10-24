import { atom, useSelector } from '../../src/kinfolk'
const count = atom(0)
function Component() {
  const a: number = useSelector(count)
  const b: number = useSelector(() => count(), [])
  const c: number = useSelector(count, {
    equal: (previous, next) => previous.toFixed() === next.toFixed(),
  })
  const d: number = useSelector(() => count(), [], {
    equal: (previous, next) => previous.toFixed() === next.toFixed(),
  })
  const e: number = useSelector(count, undefined, { label: 'count' })
  const deps = [1] as const
  const f: number = useSelector(() => count(), deps)
  // @ts-expect-error Options do not contain dependency arrays.
  useSelector(count, { deps: [] })
  // @ts-expect-error Options cannot occupy both argument positions.
  useSelector(count, { label: 'a' }, { label: 'b' })
  const wrongEqual = (previous: string, next: string) => previous === next
  // @ts-expect-error Comparators preserve the selected value type.
  useSelector(count, { equal: wrongEqual })
  void a
  void b
  void c
  void d
  void e
  void f
  return null
}
void Component
