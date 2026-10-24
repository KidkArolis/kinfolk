import React, { Suspense } from 'react'
import { test, expect, afterEach, vi } from 'vitest'
import { render, renderHook, cleanup, act } from '@testing-library/react'
import {
  atom,
  selector,
  createStore,
  Provider,
  useSelector,
} from '../src/kinfolk'

afterEach(cleanup)

test('discarded suspended renders do not retain nonpersistent selectors', () => {
  const store = createStore()
  const count = atom(1)
  const selected = selector(() => count() * 2, { persist: false })
  const pending = new Promise(() => {})
  function App() {
    useSelector(selected)
    throw pending
  }
  const view = render(
    <Provider store={store}>
      <Suspense fallback='Loading'>
        <App />
      </Suspense>
    </Provider>,
  )
  expect(view.container.textContent).toBe('Loading')
  view.unmount()
  expect(
    [...store.atomStates.values()].filter((state) => state.kind === 'selector'),
  ).toEqual([])
  expect(store.debug().__selectors).toEqual({})
  expect(store.get(count)).toBe(1)
})

test('a suspended render can retry, subscribe, update and dispose', async () => {
  const store = createStore()
  const count = atom(1)
  const selected = selector(() => count() * 2, { persist: false })
  let ready = false
  let resolve
  const pending = new Promise((r) => {
    resolve = r
  })
  function App() {
    const value = useSelector(selected)
    if (!ready) throw pending
    return <span>{value}</span>
  }
  const view = render(
    <Provider store={store}>
      <Suspense fallback='Loading'>
        <App />
      </Suspense>
    </Provider>,
  )
  await act(async () => {
    ready = true
    resolve()
  })
  expect(view.container.textContent).toBe('2')
  act(() => store.set(count, 3))
  expect(view.container.textContent).toBe('6')
  expect(store.atomStates.has(selected)).toBe(true)
  view.unmount()
  expect(
    [...store.atomStates.values()].filter((state) => state.kind === 'selector'),
  ).toEqual([])
})

test('nonpersistent store reads reuse a cache until its subscription is disposed', () => {
  const store = createStore()
  const count = atom(1)
  const calculate = vi.fn(() => ({ count: count() }))
  const selected = selector(calculate, { persist: false })
  const first = store.get(selected)
  expect(store.get(selected)).toBe(first)
  expect(calculate).toHaveBeenCalledTimes(1)
  const hook = renderHook(() => useSelector(selected), {
    wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
  })
  expect(hook.result.current).toBe(first)
  hook.unmount()
  expect(store.get(selected)).not.toBe(first)
  expect(calculate).toHaveBeenCalledTimes(2)
})

test('switching dependencies disposes an unused nonpersistent parent', () => {
  const store = createStore()
  const chooseLeft = atom(true)
  const left = selector(() => ({ name: 'left' }), { persist: false })
  const right = selector(() => ({ name: 'right' }), { persist: false })
  const hook = renderHook(
    () => useSelector(() => (chooseLeft() ? left() : right()), []),
    {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    },
  )
  const first = hook.result.current
  expect(store.atomStates.has(left)).toBe(true)
  act(() => store.set(chooseLeft, false))
  expect(hook.result.current).toEqual({ name: 'right' })
  expect(store.atomStates.has(left)).toBe(false)
  expect(store.atomStates.has(right)).toBe(true)
  expect(store.get(left)).not.toBe(first)
  hook.unmount()
  expect(store.atomStates.has(right)).toBe(false)
})
