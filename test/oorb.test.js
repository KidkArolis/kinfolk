import test from 'ava'
import { JSDOM } from 'jsdom'
import { render, fireEvent, waitFor, screen } from '@testing-library/react'
import React, { useState } from 'react'
import { Provider, atom, selector, useAtom, useAtomValue } from '../src/kinfolk'

const dom = new JSDOM('<!doctype html><div id="root"></div>')
global.window = dom.window
global.document = dom.window.document

globalThis.IS_REACT_ACT_ENVIRONMENT = true

test('basic test', async (t) => {
  function App() {
    const [clicked, setClicked] = useState()
    return (
      <div>
        <button onClick={() => setClicked(true)}>Click me</button>
        <div className='content'>{clicked ? 'clicked' : 'not clicked'}</div>
      </div>
    )
  }

  const { container } = render(<App />)

  t.is(container.querySelector('.content').innerHTML, 'not clicked')
  fireEvent.click(container.querySelector('button'))
  t.is(container.querySelector('.content').innerHTML, 'clicked')
})

test('basic atom and selector', async (t) => {
  const counter = atom(0)
  const double = selector((get) => get(counter) * 2)

  function App() {
    const [val1, setCounter] = useAtom(counter)
    const val2 = useAtomValue(double)

    return (
      <div>
        <button onClick={() => setCounter((c) => c + 1)}>Increment</button>
        <div className='content-1'>{val1}</div>
        <div className='content-2'>{val2}</div>
      </div>
    )
  }

  const { container } = render(
    <Provider>
      <App />
    </Provider>
  )

  t.is(container.querySelector('.content-1').innerHTML, '0')
  t.is(container.querySelector('.content-2').innerHTML, '0')
  fireEvent.click(container.querySelector('button'))
  t.is(container.querySelector('.content-1').innerHTML, '1')
  t.is(container.querySelector('.content-2').innerHTML, '2')
  fireEvent.click(container.querySelector('button'))
  t.is(container.querySelector('.content-1').innerHTML, '2')
  t.is(container.querySelector('.content-2').innerHTML, '4')
})
