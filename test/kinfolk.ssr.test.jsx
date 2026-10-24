// @vitest-environment node
import React from 'react'
import { PassThrough } from 'node:stream'
import {
  renderToPipeableStream,
  renderToStaticMarkup,
  renderToString,
} from 'react-dom/server'
import { expect, test } from 'vitest'
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

test('server rendering reads atoms and selectors without a DOM or subscriptions', () => {
  expect(typeof window).toBe('undefined')
  expect(typeof document).toBe('undefined')
  const count = atom(2)
  const doubled = selector(() => count() * 2)
  const store = createStore()
  store.set(count, 4)
  store.get(doubled)
  function App() {
    const value = useSelector(count)
    const double = useSelector(doubled)
    const triple = useSelector(() => count() * 3, [])
    useSetter(count)
    useReducer(count, (n) => n + 1)
    return <span>{`${value}/${double}/${triple}`}</span>
  }
  expect(
    renderToString(
      <Provider store={store}>
        <App />
      </Provider>,
    ),
  ).toBe('<span>4/8/12</span>')
  expect(
    renderToStaticMarkup(
      <Provider>
        <App />
      </Provider>,
    ),
  ).toBe('<span>2/4/6</span>')
  for (const state of store.atomStates.values()) {
    expect(state.listeners.size).toBe(0)
    expect(state.children.size).toBe(0)
  }
})

test('server requests and isolated contexts use their own initial state', () => {
  const count = atom(0)
  const scoped = createContext()
  const family = selector((factor) => count() * factor)
  function App() {
    const global = useSelector(count)
    const local = scoped.useSelector(() => family(2))
    return <span>{`${global}/${local}`}</span>
  }
  function renderRequest(value) {
    const request = createStore()
    const library = createStore()
    request.set(count, value)
    library.set(count, value + 1)
    return renderToString(
      <Provider store={request}>
        <scoped.Provider store={library}>
          <App />
        </scoped.Provider>
      </Provider>,
    )
  }
  expect(renderRequest(2)).toBe('<span>2/6</span>')
  expect(renderRequest(10)).toBe('<span>10/22</span>')
  expect(renderRequest(2)).toBe('<span>2/6</span>')
})

function renderStream(element) {
  return new Promise((resolve, reject) => {
    const output = new PassThrough()
    let html = ''
    output.on('data', (chunk) => {
      html += chunk
    })
    output.on('end', () => resolve(html))
    output.on('error', reject)
    const stream = renderToPipeableStream(element, {
      onAllReady() {
        stream.pipe(output)
      },
      onError: reject,
    })
  })
}

test('concurrent server streams keep stores isolated', async () => {
  const count = atom(0)
  function App() {
    return <span>{useSelector(count)}</span>
  }
  const first = createStore()
  const second = createStore()
  first.set(count, 3)
  second.set(count, 9)
  const html = await Promise.all([
    renderStream(
      <Provider store={first}>
        <App />
      </Provider>,
    ),
    renderStream(
      <Provider store={second}>
        <App />
      </Provider>,
    ),
  ])
  expect(html).toEqual(['<span>3</span>', '<span>9</span>'])
})
