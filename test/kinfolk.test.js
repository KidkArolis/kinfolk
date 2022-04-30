import test from 'ava'
import { JSDOM } from 'jsdom'
import { render, fireEvent, waitFor, screen } from '@testing-library/react'
import React, { useState, useEffect, useRef } from 'react'
import {
  Provider,
  atom,
  selector,
  useValue,
  useSet,
  useSelector,
  useSelectorList,
  useSelectorMap,
  shallowMapEquals,
} from '../src/kinfolk'

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
        <div className='step'>{step}</div>
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

  t.is(container.querySelector('.step').innerHTML, '0')
  t.is(container.querySelector('.content-1').innerHTML, '1')
  t.is(container.querySelector('.content-2').innerHTML, '2')
  t.is(container.querySelector('.content-3').innerHTML, '2')
  t.deepEqual(mounted(), ['counter1', 'counter2', 'double'])

  fireEvent.click(container.querySelector('button'))

  t.is(container.querySelector('.step').innerHTML, '1')
  t.is(container.querySelector('.content-1'), null)
  t.is(container.querySelector('.content-2').innerHTML, '2')
  t.is(container.querySelector('.content-3').innerHTML, '2')
  t.deepEqual(mounted(), ['counter1', 'counter2', 'double'])

  fireEvent.click(container.querySelector('button'))

  t.is(container.querySelector('.step').innerHTML, '2')
  t.is(container.querySelector('.content-1'), null)
  t.is(container.querySelector('.content-2'), null)
  t.is(container.querySelector('.content-3').innerHTML, '2')
  t.deepEqual(mounted(), ['counter1', 'double'])

  fireEvent.click(container.querySelector('button'))

  t.is(container.querySelector('.step').innerHTML, '3')
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

test('inline selector', async (t) => {
  const counter = atom(2, { label: 'counter' })

  function App() {
    const [multiplier, setMultiplier] = useState(2)
    return (
      <div>
        <button onClick={() => setMultiplier((m) => m + 1)}>Increment multiplier</button>
        <Content multiplier={multiplier} />
      </div>
    )
  }

  function Content({ multiplier }) {
    const val1 = useSelector((get) => get(counter) * multiplier, [multiplier], `multiplier-${multiplier}`)

    return (
      <div>
        <div className='content-1'>{val1}</div>
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
  t.is(container.querySelector('.content-1').innerHTML, '4')
  t.deepEqual(mounted(), ['multiplier-2', 'counter'])

  fireEvent.click(container.querySelector('button'))
  t.is(container.querySelector('.content-1').innerHTML, '6')
  t.deepEqual(mounted(), ['counter', 'multiplier-3'])
})

test('selector that returns an object', async (t) => {
  let computes = { combo: 0, derived: 0 }

  const counter = atom(21, { label: 'counter' })
  const unrelated = atom('unrelated', { label: 'unrelated' })
  const combo = selector(
    (get) => {
      computes.combo += 1
      return {
        double: get(counter) * 2,
        triple: get(counter) * 3,
        other: get(unrelated) !== 'never',
      }
    },
    { label: 'combo', equal: shallowMapEquals }
  )
  const derived = selector(
    (get) => {
      computes.derived += 1
      return get(combo)
    },
    { label: 'derived' }
  )

  function App() {
    const [step, setStep] = useState(0)
    const setUnrelated = useSet(unrelated)
    const val = useValue(derived)

    useEffect(() => {
      setUnrelated(`unrelated-${step}`)
    }, [step])

    return (
      <>
        <button onClick={() => setStep((s) => s + 1)}>Next step</button>
        <div className='content'>
          {val.double} / {val.triple}
        </div>
      </>
    )
  }

  const { container } = render(
    <Provider>
      <App />
    </Provider>
  )

  t.is(container.querySelector('.content').innerHTML, '42 / 63')
  t.is(computes.combo, 2)
  t.is(computes.derived, 1)

  fireEvent.click(container.querySelector('button'))
  t.is(container.querySelector('.content').innerHTML, '42 / 63')
  t.is(computes.combo, 3)
  t.is(computes.derived, 1)
})

test('useSelector for reading data cache allows optimal re-renders', async (t) => {
  const cache = atom(
    {
      items: {
        1: { id: 1, name: 'foo' },
        2: { id: 2, name: 'bar' },
      },
    },
    { label: 'cache' }
  )

  function App() {
    return (
      <>
        <Button />
        <Item id={1} />
        <Item id={2} />
      </>
    )
  }

  function Button() {
    const [step, setStep] = useState(0)
    const setCache = useSet(cache)

    useEffect(() => {
      const update = () =>
        setCache((cache) => {
          return {
            ...cache,
            items: {
              ...cache.items,
              2: { id: 2, name: `bar-${step}` },
            },
          }
        })
      // updates are batched!
      update()
      update()
      update()
    }, [step])

    return <button onClick={() => setStep((s) => s + 1)}>Next step</button>
  }

  function Item({ id }) {
    const renders = useRef(0)
    renders.current += 1

    const item = useSelector((get) => get(cache).items[id], [id])

    return (
      <div className={`item-${id}`}>
        {item.name}: {renders.current}
      </div>
    )
  }

  const { container } = render(
    <Provider>
      <App />
    </Provider>
  )

  t.is(container.querySelector('.item-1').innerHTML, 'foo: 1')
  t.is(container.querySelector('.item-2').innerHTML, 'bar-0: 2')

  fireEvent.click(container.querySelector('button'))

  t.is(container.querySelector('.item-1').innerHTML, 'foo: 1')
  t.is(container.querySelector('.item-2').innerHTML, 'bar-1: 3')

  fireEvent.click(container.querySelector('button'))

  t.is(container.querySelector('.item-1').innerHTML, 'foo: 1')
  t.is(container.querySelector('.item-2').innerHTML, 'bar-2: 4')
})

test('useSelectorList compares resulting list shallowly', async (t) => {
  const counter = atom({ count: 0, unrelated: 0 }, { label: 'cache' })

  function App() {
    return (
      <>
        <Button name='count' />
        <Button name='unrelated' />
        <Item id={1} />
        <Item id={2} />
      </>
    )
  }

  function Button({ name }) {
    const setCounter = useSet(counter)
    return (
      <button className={`button-${name}`} onClick={() => setCounter((s) => ({ ...s, [name]: s[name] + 1 }))}>
        Next step
      </button>
    )
  }

  function Item({ id }) {
    const renders = useRef(0)
    renders.current += 1

    const items = useSelectorList(
      (get) => {
        if (id === 1) {
          return [1, 2, 3]
        } else {
          return [get(counter).count, get(counter).count, get(counter).count]
        }
      },
      [id]
    )

    return (
      <div className={`item-${id}`}>
        {items.join(',')}: {renders.current}
      </div>
    )
  }

  const { container } = render(
    <Provider>
      <App />
    </Provider>
  )

  t.is(container.querySelector('.item-1').innerHTML, '1,2,3: 1')
  t.is(container.querySelector('.item-2').innerHTML, '0,0,0: 1')

  fireEvent.click(container.querySelector('.button-unrelated'))
  fireEvent.click(container.querySelector('.button-unrelated'))

  t.is(container.querySelector('.item-1').innerHTML, '1,2,3: 1')
  t.is(container.querySelector('.item-2').innerHTML, '0,0,0: 1')

  fireEvent.click(container.querySelector('.button-count'))

  t.is(container.querySelector('.item-1').innerHTML, '1,2,3: 1')
  t.is(container.querySelector('.item-2').innerHTML, '1,1,1: 2')

  fireEvent.click(container.querySelector('.button-count'))
  fireEvent.click(container.querySelector('.button-count'))
  fireEvent.click(container.querySelector('.button-unrelated'))
  fireEvent.click(container.querySelector('.button-unrelated'))

  t.is(container.querySelector('.item-1').innerHTML, '1,2,3: 1')
  t.is(container.querySelector('.item-2').innerHTML, '3,3,3: 4')

  fireEvent.click(container.querySelector('.button-unrelated'))
  fireEvent.click(container.querySelector('.button-unrelated'))

  t.is(container.querySelector('.item-1').innerHTML, '1,2,3: 1')
  t.is(container.querySelector('.item-2').innerHTML, '3,3,3: 4')
})

test('useSelectorMap compares resulting obj shallowly', async (t) => {
  const counter = atom({ count: 0, unrelated: 0 }, { label: 'cache' })

  function App() {
    return (
      <>
        <Button name='count' />
        <Button name='unrelated' />
        <Item id={1} />
        <Item id={2} />
      </>
    )
  }

  function Button({ name }) {
    const setCounter = useSet(counter)
    return (
      <button className={`button-${name}`} onClick={() => setCounter((s) => ({ ...s, [name]: s[name] + 1 }))}>
        Next step
      </button>
    )
  }

  function Item({ id }) {
    const renders = useRef(0)
    renders.current += 1

    const items = useSelectorMap(
      (get) => {
        if (id === 1) {
          return { a: 1, b: 2, c: 3 }
        } else {
          return { a: get(counter).count, b: get(counter).count, c: get(counter).count }
        }
      },
      [id]
    )

    return (
      <div className={`item-${id}`}>
        {Object.values(items).join(',')}: {renders.current}
      </div>
    )
  }

  const { container } = render(
    <Provider>
      <App />
    </Provider>
  )

  t.is(container.querySelector('.item-1').innerHTML, '1,2,3: 1')
  t.is(container.querySelector('.item-2').innerHTML, '0,0,0: 1')

  fireEvent.click(container.querySelector('.button-unrelated'))
  fireEvent.click(container.querySelector('.button-unrelated'))

  t.is(container.querySelector('.item-1').innerHTML, '1,2,3: 1')
  t.is(container.querySelector('.item-2').innerHTML, '0,0,0: 1')

  fireEvent.click(container.querySelector('.button-count'))

  t.is(container.querySelector('.item-1').innerHTML, '1,2,3: 1')
  t.is(container.querySelector('.item-2').innerHTML, '1,1,1: 2')

  fireEvent.click(container.querySelector('.button-count'))
  fireEvent.click(container.querySelector('.button-count'))
  fireEvent.click(container.querySelector('.button-unrelated'))
  fireEvent.click(container.querySelector('.button-unrelated'))

  t.is(container.querySelector('.item-1').innerHTML, '1,2,3: 1')
  t.is(container.querySelector('.item-2').innerHTML, '3,3,3: 4')

  fireEvent.click(container.querySelector('.button-unrelated'))
  fireEvent.click(container.querySelector('.button-unrelated'))

  t.is(container.querySelector('.item-1').innerHTML, '1,2,3: 1')
  t.is(container.querySelector('.item-2').innerHTML, '3,3,3: 4')
})
