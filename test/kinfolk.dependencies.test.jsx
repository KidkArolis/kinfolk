import { expect, test, vi } from 'vitest'
import { atom, selector, createStore } from '../src/kinfolk'

test('cached reads validate repeated dependency chains in linear work', () => {
  const store = createStore()
  const source = atom(1)
  const depth = 12
  let derived = source
  for (let i = 0; i < depth; i++) {
    const parent = derived
    derived = selector(() => parent() + parent())
  }
  expect(store.get(derived)).toBe(2 ** depth)
  const reads = vi.spyOn(store.atomStates, 'get')
  try {
    expect(store.get(derived)).toBe(2 ** depth)
    expect(reads.mock.calls.length).toBeLessThan((depth + 1) * 4)
    store.set(source, 2)
    expect(store.get(derived)).toBe(2 ** (depth + 1))
  } finally {
    reads.mockRestore()
  }
})

test('repeated family reads preserve distinct primitive and object arguments', () => {
  const store = createStore()
  const source = atom(2)
  const factor = selector(
    (arg) => source() * (typeof arg === 'object' ? arg.factor : arg),
  )
  const first = { factor: 3 }
  const second = { factor: 4 }
  const total = selector(
    () =>
      factor(0) +
      factor(0) +
      factor(1) +
      factor(1) +
      factor(first) +
      factor(first) +
      factor(second) +
      factor(second),
  )
  expect(store.get(total)).toBe(32)
  store.set(source, 3)
  expect(store.get(total)).toBe(48)
})
