import React from 'react'
import { afterEach, expect, test } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import {
  atom,
  createStore,
  Provider,
  useSelector,
  useSetter,
  useReducer,
} from '../src/kinfolk'

afterEach(cleanup)

const optionForms = [
  function useOptions(read, options) {
    return useSelector(read, options)
  },
  function useDepsAndOptions(read, options) {
    return useSelector(read, [], options)
  },
  function useUndefinedAndOptions(read, options) {
    return useSelector(read, undefined, options)
  },
]

test.each(
  optionForms.flatMap((useRead) =>
    [false, true].map((callback) => [useRead.name, callback, useRead]),
  ),
)(
  'selector options update with %s for callback=%s',
  (_name, callback, useRead) => {
    const store = createStore()
    const value = atom({ count: 1, tag: 'a' })
    const read = callback ? () => value() : value
    const sameCount = (a, b) => a.count === b.count
    const hook = renderHook(
      ({ equal, label }) => useRead(read, { equal, label }),
      {
        initialProps: { equal: sameCount, label: 'before' },
        wrapper: ({ children }) => (
          <Provider store={store}>{children}</Provider>
        ),
      },
    )
    act(() => store.set(value, { count: 1, tag: 'b' }))
    expect(hook.result.current.tag).toBe('a')
    hook.rerender({ equal: Object.is, label: 'before' })
    expect(hook.result.current.tag).toBe('b')
    hook.rerender({ equal: Object.is, label: 'after' })
    expect(store.debug().__selectors.after).toBeDefined()
    expect(store.debug().__selectors.before).toBeUndefined()
    act(() => store.set(value, { count: 1, tag: 'c' }))
    expect(hook.result.current.tag).toBe('c')
  },
)

test('Provider switches supplied stores and retains its own default store', () => {
  const count = atom(0)
  const first = createStore()
  const second = createStore()
  first.set(count, 10)
  second.set(count, 20)
  let selected
  const hook = renderHook(
    () => [
      useSelector(count),
      useSetter(count),
      useReducer(count, (n) => n + 1),
    ],
    {
      wrapper: ({ children }) => (
        <Provider store={selected}>{children}</Provider>
      ),
    },
  )
  act(() => hook.result.current[1](5))
  selected = first
  hook.rerender()
  expect(hook.result.current[0]).toBe(10)
  act(() => hook.result.current[1](11))
  expect(first.get(count)).toBe(11)
  selected = second
  hook.rerender()
  expect(hook.result.current[0]).toBe(20)
  act(() => hook.result.current[2]())
  expect(second.get(count)).toBe(21)
  act(() => first.set(count, 99))
  expect(hook.result.current[0]).toBe(21)
  selected = undefined
  hook.rerender()
  expect(hook.result.current[0]).toBe(5)
  act(() => hook.result.current[1](6))
  act(() => second.set(count, 77))
  expect(hook.result.current[0]).toBe(6)
})
