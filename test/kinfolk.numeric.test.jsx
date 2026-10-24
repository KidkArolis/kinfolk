import React from 'react'
import { test, expect, afterEach, vi } from 'vitest'
import { renderHook, cleanup, act } from '@testing-library/react'
import {
  atom,
  selector,
  createStore,
  Provider,
  useSelector,
} from '../src/kinfolk'

afterEach(cleanup)

test('signed zero updates invalidate derived values and reach subscribers', () => {
  const store = createStore()
  const value = atom(0)
  const reciprocal = selector(() => 1 / value())
  const hook = renderHook(() => [useSelector(value), useSelector(reciprocal)], {
    wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
  })
  expect(hook.result.current).toEqual([0, Infinity])
  act(() => store.set(value, -0))
  expect(store.get(reciprocal)).toBe(-Infinity)
  expect(hook.result.current[0]).toBe(-0)
  expect(hook.result.current[1]).toBe(-Infinity)
  act(() => store.set(value, 0))
  expect(hook.result.current[0]).toBe(0)
  expect(hook.result.current[1]).toBe(Infinity)
})

test('unchanged NaN inputs preserve the selector cache', () => {
  const store = createStore()
  const value = atom(NaN)
  const calculate = vi.fn(() => ({ value: value() }))
  const selected = selector(calculate)
  const first = store.get(selected)
  expect(store.get(selected)).toBe(first)
  store.set(value, NaN)
  expect(store.get(selected)).toBe(first)
  expect(calculate).toHaveBeenCalledTimes(1)
})

test.each([[() => ({ value: NaN })], [() => [NaN]]])(
  'shallow results use Object.is for NaN entries',
  (result) => {
    const store = createStore()
    const tick = atom(0)
    const selected = selector(() => {
      tick()
      return result()
    })
    const first = store.get(selected)
    store.set(tick, 1)
    expect(store.get(selected)).toBe(first)
  },
)

test.each([[(value) => ({ value })], [(value) => [value]]])(
  'shallow results distinguish signed zero entries',
  (result) => {
    const store = createStore()
    const value = atom(0)
    const selected = selector(() => result(value()))
    const first = store.get(selected)
    store.set(value, -0)
    const next = store.get(selected)
    expect(next).not.toBe(first)
    expect(next).toEqual(result(-0))
  },
)
