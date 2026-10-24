import React from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import {
  atom,
  selector,
  createStore,
  Provider,
  useSelector,
} from '../src/kinfolk'

afterEach(cleanup)

test('clearCache evicts one argument or the whole family in one store', () => {
  const count = atom(2)
  const calculate = vi.fn((arg) => ({ value: count() * (arg ?? 1) }))
  const family = selector(calculate)
  const first = createStore()
  const second = createStore()
  const omitted = first.get(family)
  const a = first.get(family, 2)
  const b = first.get(family, 3)
  const other = second.get(family, 2)
  first.clearCache(family, 2)
  expect(first.get(family, 2)).not.toBe(a)
  expect(first.get(family, 3)).toBe(b)
  expect(second.get(family, 2)).toBe(other)
  expect(first.get(family)).toBe(omitted)
  first.clearCache(family, undefined)
  expect(first.get(family)).not.toBe(omitted)
  expect(first.get(family, 3)).toBe(b)
  first.clearCache(family)
  expect(first.get(family, 3)).not.toBe(b)
  const calls = calculate.mock.calls.length
  first.clearCache(family, 'missing')
  first.clearCache(family)
  first.clearCache(family)
  expect(calculate).toHaveBeenCalledTimes(calls)
  first.clearCache(selector(() => 1))
  expect(() => first.clearCache(count)).toThrow('Expected a Kinfolk selector')
  expect(() => first.clearCache(() => 1)).toThrow(
    'Expected a Kinfolk atom or selector',
  )
})

test('clearing a family cache uses object identity for arguments', () => {
  const family = selector((arg) => ({ value: arg.value }))
  const store = createStore()
  const first = { value: 1 }
  const second = { value: 1 }
  const a = store.get(family, first)
  const b = store.get(family, second)
  store.clearCache(family, first)
  expect(store.get(family, first)).not.toBe(a)
  expect(store.get(family, second)).toBe(b)
})

test('clearing active family caches preserves subscriptions and derived values', () => {
  const store = createStore()
  const count = atom(2)
  const read = selector((factor = 1) => ({ value: count() * factor }))
  const derived = selector(() => read(2).value + read(3).value)
  const wrapper = ({ children }) => (
    <Provider store={store}>{children}</Provider>
  )
  const hook = renderHook(
    () => [useSelector(() => read(2), []), useSelector(derived)],
    { wrapper },
  )
  expect(hook.result.current).toEqual([{ value: 4 }, 10])
  const before = hook.result.current[0]
  act(() => store.clearCache(read, 2))
  expect(store.get(read, 2)).not.toBe(before)
  expect(hook.result.current[0]).toBe(before)
  expect(hook.result.current).toEqual([{ value: 4 }, 10])
  act(() => store.set(count, 3))
  expect(hook.result.current).toEqual([{ value: 6 }, 15])
  act(() => store.clearCache(read))
  act(() => store.clearCache(derived))
  act(() => store.set(count, 4))
  expect(hook.result.current).toEqual([{ value: 8 }, 20])
  hook.unmount()
  store.clearCache(read)
  store.clearCache(derived)
  expect(store.atomStates.get(count).children.size).toBe(0)
})

test('clearing nonpersistent caches releases dependencies from discarded renders', () => {
  const store = createStore()
  const chooseLeft = atom(true)
  const left = selector(() => ({ name: 'left' }), { persist: false })
  const right = selector(() => ({ name: 'right' }), { persist: false })
  const choice = selector(() => (chooseLeft() ? left() : right()), {
    persist: false,
  })
  expect(store.get(choice).name).toBe('left')
  store.clearCache(choice)
  store.set(chooseLeft, false)
  expect(store.get(choice).name).toBe('right')
  const hook = renderHook(() => useSelector(choice), {
    wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
  })
  act(() => store.clearCache(choice))
  expect(hook.result.current.name).toBe('right')
  hook.unmount()
  expect(store.atomStates.has(choice)).toBe(false)
  store.clearCache(choice)
})
