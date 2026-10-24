import React, { Suspense, useEffect } from 'react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { act, fireEvent } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import {
  atom,
  selector,
  createContext,
  createStore,
  Provider,
  useSelector,
  useSetter,
  useReducer,
} from '../src/kinfolk'

test.each([false, true])(
  'server HTML hydrates and subscribes with isolated context=%s',
  async (isolated) => {
    const scope = isolated
      ? createContext()
      : { Provider, useSelector, useSetter, useReducer }
    const count = atom({ value: 1 })
    const doubled = selector(() => ({ value: count().value * 2 }))
    function App() {
      const current = scope.useSelector(count)
      const double = scope.useSelector(doubled)
      const set = scope.useSetter(count)
      const increment = scope.useReducer(count, (state) => ({
        value: state.value + 1,
      }))
      return (
        <div>
          <span>{`${current.value}/${double.value}`}</span>
          <button onClick={() => set({ value: 5 })}>Set</button>
          <button onClick={increment}>Increment</button>
        </div>
      )
    }
    const server = createStore()
    server.set(count, { value: 3 })
    const container = document.createElement('div')
    container.innerHTML = renderToString(
      <scope.Provider store={server}>
        <App />
      </scope.Provider>,
    )
    document.body.append(container)
    const span = container.querySelector('span')
    const client = createStore()
    client.set(count, JSON.parse(JSON.stringify(server.get(count))))
    const onRecoverableError = vi.fn()
    let root
    try {
      await act(async () => {
        root = hydrateRoot(
          container,
          <scope.Provider store={client}>
            <App />
          </scope.Provider>,
          { onRecoverableError },
        )
      })
      expect(container.querySelector('span')).toBe(span)
      expect(span.textContent).toBe('3/6')
      fireEvent.click(container.querySelectorAll('button')[0])
      expect(span.textContent).toBe('5/10')
      fireEvent.click(container.querySelectorAll('button')[1])
      expect(span.textContent).toBe('6/12')
      act(() => client.set(count, { value: 7 }))
      expect(span.textContent).toBe('7/14')
      expect(server.get(count)).toEqual({ value: 3 })
      expect(onRecoverableError).not.toHaveBeenCalled()
    } finally {
      if (root) await act(async () => root.unmount())
      container.remove()
    }
    for (const state of client.atomStates.values())
      expect(state.listeners.size).toBe(0)
  },
)

test('delayed hydration uses the initial snapshot after the live store changes', async () => {
  const count = atom(1)
  const server = createStore()
  const client = createStore()
  server.set(count, 4)
  client.set(count, 4)
  let ready = true
  let resume
  const pending = new Promise((resolve) => {
    resume = resolve
  })
  function Delayed() {
    if (!ready) throw pending
    return <span>{useSelector(count)}</span>
  }
  function App({ store }) {
    useEffect(() => {
      store.set(count, 5)
    }, [store])
    return (
      <Provider store={store}>
        <Suspense fallback='Loading'>
          <Delayed />
        </Suspense>
      </Provider>
    )
  }
  const container = document.createElement('div')
  container.innerHTML = renderToString(<App store={server} />)
  document.body.append(container)
  const span = container.querySelector('span')
  const onRecoverableError = vi.fn()
  ready = false
  let root
  try {
    await act(async () => {
      root = hydrateRoot(container, <App store={client} />, {
        onRecoverableError,
      })
    })
    expect(client.get(count)).toBe(5)
    expect(span.textContent).toBe('4')
    await act(async () => {
      ready = true
      resume()
    })
    expect(container.querySelector('span')).toBe(span)
    expect(span.textContent).toBe('5')
    expect(onRecoverableError).not.toHaveBeenCalled()
    act(() => client.set(count, 6))
    expect(span.textContent).toBe('6')
  } finally {
    if (root) await act(async () => root.unmount())
    container.remove()
  }
})
