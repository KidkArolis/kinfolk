import test from 'ava'
import { JSDOM } from 'jsdom'
import { render, fireEvent, waitFor, screen } from '@testing-library/react'
import React, { useState, useEffect } from 'react'
import { Provider, atom, selector, useValue, useSet } from '../src/kinfolk'

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
    const val1 = useValue(counter)
    const val2 = useValue(double)
    const setCounter = useSet(counter)

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

test('selector without atom being directly used', async (t) => {
  const counter = atom(21)
  const double = selector((get) => get(counter) * 2)

  function App() {
    const val1 = useValue(double)

    return (
      <div>
        <div className='content-1'>{val1}</div>
      </div>
    )
  }

  const { container } = render(
    <Provider>
      <App />
    </Provider>
  )

  t.is(container.querySelector('.content-1').innerHTML, '42')
})

test('unmounting unused atoms', async (t) => {
  const counter1 = atom(1, { label: 'counter1' })
  const counter2 = atom(2, { label: 'counter2' })
  const double = selector((get) => get(counter1) * 2, { label: 'double' })

  function Counter({ id, atom }) {
    const val = useValue(atom)
    return <div className={`content-${id}`}>{val}</div>
  }

  function Inc({ atom }) {
    const set = useSet(atom)
    useEffect(() => {
      set((c) => c + 1)
    }, [atom])
    return null
  }

  function App() {
    const [step, setStep] = useState(0)
    return (
      <div>
        <button onClick={() => setStep((s) => s + 1)}>Next step</button>
        {step <= 0 && <Counter id='1' atom={counter1} />}
        {step <= 1 && <Counter id='2' atom={counter2} />}
        {step <= 2 && <Counter id='3' atom={double} />}
        {step === 4 && <Counter id='4' atom={double} />}
        {step === 4 && <Inc atom={counter1} />}
      </div>
    )
  }

  let store, getState
  const { container } = render(
    <Provider onMount={(store_, getState_) => ((store = store_), (getState = getState_))}>
      <App />
    </Provider>
  )

  const mounted = () => getState().map((a) => a.label)

  t.is(container.querySelector('.content-1').innerHTML, '1')
  t.is(container.querySelector('.content-2').innerHTML, '2')
  t.is(container.querySelector('.content-3').innerHTML, '2')
  t.deepEqual(mounted(), ['counter1', 'counter2', 'double'])

  fireEvent.click(container.querySelector('button'))

  t.is(container.querySelector('.content-1'), null)
  t.is(container.querySelector('.content-2').innerHTML, '2')
  t.is(container.querySelector('.content-3').innerHTML, '2')
  t.deepEqual(mounted(), ['counter1', 'counter2', 'double'])

  fireEvent.click(container.querySelector('button'))

  t.is(container.querySelector('.content-1'), null)
  t.is(container.querySelector('.content-2'), null)
  t.is(container.querySelector('.content-3').innerHTML, '2')
  t.deepEqual(mounted(), ['counter1', 'double'])

  fireEvent.click(container.querySelector('button'))

  t.is(container.querySelector('.content-1'), null)
  t.is(container.querySelector('.content-2'), null)
  t.is(container.querySelector('.content-3'), null)
  t.deepEqual(mounted(), [])

  fireEvent.click(container.querySelector('button'))

  t.is(container.querySelector('.content-1'), null)
  t.is(container.querySelector('.content-2'), null)
  t.is(container.querySelector('.content-3'), null)
  t.is(container.querySelector('.content-4').innerHTML, '4')
  t.deepEqual(mounted(), ['double', 'counter1'])
})

// TODO - mount same shiz multiple timesos
