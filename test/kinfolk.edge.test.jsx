import React, { StrictMode } from 'react'
import { test, expect, afterEach, vi } from 'vitest'
import { renderHook, cleanup, act } from '@testing-library/react'
import {
  atom,
  selector,
  createStore,
  createContext,
  Provider,
  useSelector,
  useSetter,
  useReducer,
} from '../src/kinfolk'

afterEach(cleanup)

test('references require a selector evaluation and restore the getter after errors', () => {
  const value = atom(3)
  const double = selector(() => value() * 2)
  expect(() => value()).toThrow('Atoms can only be read in selectors')
  expect(() => double()).toThrow('Atoms can only be read in selectors')
  const store = createStore()
  const broken = selector(() => {
    double()
    throw new Error('failed')
  })
  expect(() => store.get(broken)).toThrow('failed')
  expect(() => value()).toThrow('Atoms can only be read in selectors')
  expect(store.get(double)).toBe(6)
  store.set(value, 4)
  expect(store.get(double)).toBe(8)
})

test('nested store evaluations restore the outer dependency getter', () => {
  const a = atom(1)
  const b = atom(2)
  const innerStore = createStore()
  const outerStore = createStore()
  const inner = selector(() => a())
  const outer = selector(() => innerStore.get(inner) + b())
  expect(outerStore.get(outer)).toBe(3)
  outerStore.set(b, 4)
  expect(outerStore.get(outer)).toBe(5)
})

test('stores reject foreign references and selector writes', () => {
  const store = createStore()
  expect(() => store.get(() => 1)).toThrow(
    'Expected a Kinfolk atom or selector',
  )
  expect(() =>
    store.set(
      selector(() => 1),
      2,
    ),
  ).toThrow('Only atoms can be updated')
})

test.each([
  () => useSelector(atom(1)),
  () => useSetter(atom(1)),
  () => useReducer(atom(1), (value) => value),
])('hooks require their context Provider', (hook) => {
  expect(() => renderHook(hook)).toThrow(
    'Kinfolk hooks must be used within their Provider',
  )
})

test('custom equality reuses previous values', () => {
  const store = createStore()
  const count = atom(0)
  const equal = vi.fn((a, b) => a.group === b.group)
  const group = selector(() => ({ group: Math.floor(count() / 2) }), { equal })
  const first = store.get(group)
  store.set(count, 1)
  expect(store.get(group)).toBe(first)
  store.set(count, 2)
  expect(store.get(group)).toEqual({ group: 1 })
  expect(equal).toHaveBeenCalledTimes(2)
})

const equalCases = [
  [null, null, true],
  [undefined, undefined, true],
  [null, {}, false],
  [{}, null, false],
  [1, 2, false],
  [{ a: 1 }, { a: 2 }, false],
  [{ a: 1 }, { a: 1, b: 2 }, false],
  [{ a: 1, b: 2 }, { a: 1 }, false],
  [{ a: 1 }, { a: 1 }, true],
  [[], [], true],
  [[1], [1], true],
  [[1], [2], false],
  [[1], [1, 2], false],
  [{}, [], false],
  [[], {}, false],
  [new Date(0), new Date(0), false],
  [NaN, NaN, true],
  [0, -0, false],
]
test.each(equalCases)(
  'default equality for %j and %j',
  (before, after, equal) => {
    const store = createStore()
    const tick = atom(0)
    const selected = selector(() => (tick() === 0 ? before : after))
    const first = store.get(selected)
    store.set(tick, 1)
    expect(store.get(selected)).toBe(equal ? first : after)
  },
)

test('debug groups duplicate atom and selector labels', () => {
  const store = createStore()
  const values = [
    atom(1, { label: 'same' }),
    atom(2, { label: 'same' }),
    atom(3, { label: 'same' }),
  ]
  const selections = [
    selector(() => 1, { label: 'same' }),
    selector(() => 2, { label: 'same' }),
    selector(() => 3, { label: 'same' }),
  ]
  values.forEach((value) => store.get(value))
  selections.forEach((value) => store.get(value))
  expect(store.debug().same).toEqual([1, 2, 3])
  expect(store.debug().__selectors.same).toHaveLength(3)
  expect([...store.debug().__selectors.same[0].values()][0].value).toBe(1)
})

test('atoms and selector caches are isolated between stores and providers', () => {
  const value = atom(0)
  const double = selector(() => value() * 2)
  const a = createStore()
  const b = createStore()
  a.set(value, 2)
  expect(a.get(double)).toBe(4)
  expect(b.get(double)).toBe(0)
  const hook = renderHook(() => useSelector(value), {
    wrapper: ({ children }) => <Provider>{children}</Provider>,
  })
  expect(hook.result.current).toBe(0)
  const isolated = createContext()
  expect(() =>
    renderHook(() => isolated.useSelector(value), { wrapper: Provider }),
  ).toThrow('Kinfolk hooks must be used within their Provider')
})

test('setters accept direct values and do not notify for unchanged values', () => {
  const store = createStore()
  const count = atom(0)
  const renders = vi.fn()
  const hook = renderHook(
    () => {
      renders()
      return [useSelector(count), useSetter(count), useReducer(count, (n) => n)]
    },
    {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    },
  )
  act(() => hook.result.current[1](5))
  expect(hook.result.current[0]).toBe(5)
  const before = renders.mock.calls.length
  act(() => {
    hook.result.current[1](5)
    hook.result.current[2]()
  })
  expect(renders).toHaveBeenCalledTimes(before)
})

test('changing callback dependencies and reference props refreshes subscriptions', () => {
  const first = atom(2)
  const second = atom(3)
  const store = createStore()
  const hook = renderHook(
    ({ ref, multiplier }) => [
      useSelector(ref),
      useSelector(() => ref() * multiplier, { deps: [ref, multiplier] }),
    ],
    {
      initialProps: { ref: first, multiplier: 2 },
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    },
  )
  expect(hook.result.current).toEqual([2, 4])
  hook.rerender({ ref: second, multiplier: 3 })
  expect(hook.result.current).toEqual([3, 9])
  act(() => store.set(second, 4))
  expect(hook.result.current).toEqual([4, 12])
  act(() => store.set(first, 10))
  expect(hook.result.current).toEqual([4, 12])
})

test('callbacks without a dependency list capture each render', () => {
  const hook = renderHook(({ value }) => useSelector(() => value), {
    initialProps: { value: 1 },
    wrapper: Provider,
  })
  expect(hook.result.current).toBe(1)
  hook.rerender({ value: 2 })
  expect(hook.result.current).toBe(2)
})

test('dynamic selectors remove old dependencies', () => {
  const store = createStore()
  const chooseA = atom(true)
  const a = atom(1)
  const b = atom(2)
  const calculate = vi.fn(() => (chooseA() ? a() : b()))
  const selected = selector(calculate)
  expect(store.get(selected)).toBe(1)
  store.set(chooseA, false)
  expect(store.get(selected)).toBe(2)
  const before = calculate.mock.calls.length
  store.set(a, 10)
  expect(store.get(selected)).toBe(2)
  expect(calculate).toHaveBeenCalledTimes(before)
  store.set(b, 20)
  expect(store.get(selected)).toBe(20)
})

test('StrictMode can subscribe, dispose and subscribe again', () => {
  const store = createStore()
  const value = atom(1)
  const selected = selector(() => value() * 2, { persist: false })
  const hook = renderHook(() => useSelector(selected), {
    wrapper: ({ children }) => (
      <StrictMode>
        <Provider store={store}>{children}</Provider>
      </StrictMode>
    ),
  })
  expect(hook.result.current).toBe(2)
  act(() => store.set(value, 3))
  expect(hook.result.current).toBe(6)
  hook.unmount()
  expect(store.atomStates.has(selected)).toBe(false)
})

test('persisted selectors reconnect after their last subscriber unmounts', () => {
  const store = createStore()
  const value = atom(1)
  const doubled = selector(() => value() * 2)
  const wrapper = ({ children }) => (
    <Provider store={store}>{children}</Provider>
  )
  const first = renderHook(() => useSelector(doubled), { wrapper })
  first.unmount()
  const second = renderHook(() => useSelector(doubled), { wrapper })
  expect(second.result.current).toBe(2)
  act(() => store.set(value, 3))
  expect(second.result.current).toBe(6)
})

test('selector families subscribe to the inputs of every cached argument', () => {
  const store = createStore()
  const a = atom(1)
  const b = atom(2)
  const family = selector((key) => (key === 'a' ? a() : b()))
  const wrapper = ({ children }) => (
    <Provider store={store}>{children}</Provider>
  )
  const first = renderHook(() => useSelector(() => family('a'), { deps: [] }), {
    wrapper,
  })
  const second = renderHook(
    () => useSelector(() => family('b'), { deps: [] }),
    {
      wrapper,
    },
  )
  act(() => store.set(a, 3))
  expect(first.result.current).toBe(3)
  expect(second.result.current).toBe(2)
  act(() => store.set(b, 4))
  expect(first.result.current).toBe(3)
  expect(second.result.current).toBe(4)
})

test('debug retains duplicate falsy and array values', () => {
  const store = createStore()
  const values = [
    atom(0, { label: 'zero' }),
    atom(false, { label: 'zero' }),
    atom([1], { label: 'array' }),
    atom([2], { label: 'array' }),
    atom([3], { label: 'array' }),
  ]
  values.forEach((value) => store.get(value))
  expect(store.debug().zero).toEqual([0, false])
  expect(store.debug().array).toEqual([[1], [2], [3]])
  expect(store.get(values[2])).toEqual([1])
})
