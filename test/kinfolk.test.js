import test from 'ava'
import { JSDOM } from 'jsdom'
import { render, fireEvent, cleanup } from '@testing-library/react'
import React, { useState, useEffect, useRef } from 'react'
import {
  Provider,
  atom,
  selector,
  useSetter,
  useSelector,
} from '../src/kinfolk'

const dom = new JSDOM('<!doctype html><div id="root"></div>')
global.window = dom.window
global.document = dom.window.document

globalThis.IS_REACT_ACT_ENVIRONMENT = true

test.afterEach(() => {
  cleanup()
})

test('basic atom and selector', async (t) => {
  const counter = atom(0, { label: 'counter' })
  const double = selector(() => counter() * 2, { label: 'double' })

  function App() {
    const val1 = useSelector(() => counter(), [])
    const val2 = useSelector(() => double())
    const setCounter = useSetter(counter)

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
    </Provider>,
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
  const double = selector(() => counter() * 2)

  function App() {
    const val1 = useSelector(double)

    return (
      <div>
        <div className='content-1'>{val1}</div>
      </div>
    )
  }

  const { container } = render(
    <Provider>
      <App />
    </Provider>,
  )

  t.is(container.querySelector('.content-1').innerHTML, '42')
})

test('unmounting unused atoms', async (t) => {
  const counter1 = atom(1, { label: 'counter-1' })
  const counter2 = atom(2, { label: 'counter-2' })
  const double = selector(() => counter1() * 2, { label: 'counter-1-double' })

  function Counter({ id, atom }) {
    const val = useSelector(() => atom(), [atom], { label: `component-${id}` })
    return <div className={`content-${id}`}>{val}</div>
  }

  function Inc({ atom }) {
    const set = useSetter(atom)
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

  let store
  const { container } = render(
    <Provider getAtomStates={(store_) => (store = store_)}>
      <App />
    </Provider>,
  )

  const mounted = () => getState(store).map((a) => a.label)

  t.is(container.querySelector('.step').innerHTML, '0')
  t.is(container.querySelector('.content-1').innerHTML, '1')
  t.is(container.querySelector('.content-2').innerHTML, '2')
  t.is(container.querySelector('.content-3').innerHTML, '2')
  // at first 3 counter components are mounted
  // and both counter atoms
  // and the double selector
  t.deepEqual(mounted(), [
    'component-1',
    'counter-1',
    'component-2',
    'counter-2',
    'component-3',
    'counter-1-double',
  ])

  fireEvent.click(container.querySelector('button'))

  t.is(container.querySelector('.step').innerHTML, '1')
  t.is(container.querySelector('.content-1'), null)
  t.is(container.querySelector('.content-2').innerHTML, '2')
  t.is(container.querySelector('.content-3').innerHTML, '2')
  // here we unmounted the useSelector of component-1
  // but the 2 atoms and selector are still mounted
  t.deepEqual(mounted(), [
    'counter-1',
    'component-2',
    'counter-2',
    'component-3',
    'counter-1-double',
  ])

  fireEvent.click(container.querySelector('button'))

  t.is(container.querySelector('.step').innerHTML, '2')
  t.is(container.querySelector('.content-1'), null)
  t.is(container.querySelector('.content-2'), null)
  t.is(container.querySelector('.content-3').innerHTML, '2')
  // here we unmounted component-2 as well
  // but the 2 atoms and selector are still mounted
  // because we never unmount atoms, they're permanent state
  // but we did unmount the component-2 selector
  t.deepEqual(mounted(), [
    'counter-1',
    'counter-2',
    'component-3',
    'counter-1-double',
  ])

  fireEvent.click(container.querySelector('button'))

  t.is(container.querySelector('.step').innerHTML, '3')
  t.is(container.querySelector('.content-1'), null)
  t.is(container.querySelector('.content-2'), null)
  t.is(container.querySelector('.content-3'), null)
  // finally, since no components need the state anymore
  // we've unmounted not only component useSelectors but also
  // the double selector
  // atoms remain mounted permanently
  t.deepEqual(mounted(), ['counter-1', 'counter-2'])

  fireEvent.click(container.querySelector('button'))

  t.is(container.querySelector('.step').innerHTML, '4')
  t.is(container.querySelector('.content-1'), null)
  t.is(container.querySelector('.content-2'), null)
  t.is(container.querySelector('.content-3'), null)
  t.is(container.querySelector('.content-4').innerHTML, '4')
  // this is remounting the double selector
  t.deepEqual(mounted(), [
    'counter-1',
    'counter-2',
    'component-4',
    'counter-1-double',
  ])
})

test('inline selector', async (t) => {
  const counter = atom(2, { label: 'counter' })

  function App() {
    const [multiplier, setMultiplier] = useState(2)
    return (
      <div>
        <button onClick={() => setMultiplier((m) => m + 1)}>
          Increment multiplier
        </button>
        <Content multiplier={multiplier} />
      </div>
    )
  }

  function Content({ multiplier }) {
    const val1 = useSelector(() => counter() * multiplier, [multiplier])

    return (
      <div>
        <div className='content-1'>{val1}</div>
      </div>
    )
  }

  let store
  const { container } = render(
    <Provider getAtomStates={(store_) => (store = store_)}>
      <App />
    </Provider>,
  )

  const mounted = () => getState(store).map((a) => a.label)

  t.is(container.querySelector('.content-1').innerHTML, '4')
  t.deepEqual(
    mounted().map((a) => a.replace(/-\d+$/g, '-X')),
    ['selector-X', 'counter'],
  )

  fireEvent.click(container.querySelector('button'))
  t.is(container.querySelector('.content-1').innerHTML, '6')
  t.deepEqual(
    mounted().map((a) => a.replace(/-\d+$/g, '-X')),
    ['counter', 'selector-X'],
  )
})

test('useSelector for reading data cache allows optimal re-renders', async (t) => {
  const cache = atom(
    {
      items: {
        1: { id: 1, name: 'foo' },
        2: { id: 2, name: 'bar' },
      },
    },
    { label: 'cache' },
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
    const setCache = useSetter(cache)

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

    const item = useSelector(() => cache().items[id], [id])

    return (
      <div className={`item-${id}`}>
        {item.name}: {renders.current}
      </div>
    )
  }

  const { container } = render(
    <Provider>
      <App />
    </Provider>,
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

test('useSelector only recomputes if dependencies change', async (t) => {
  const counter = atom({ count: 0, unrelated: 0 }, { label: 'cache' })
  const count = selector(() => counter().count, { label: 'sel-count' })

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
    const setCounter = useSetter(counter)
    return (
      <button
        className={`button-${name}`}
        onClick={() => {
          setCounter((s) => ({ ...s, [name]: s[name] + 1 }))
        }}
      >
        Next step
      </button>
    )
  }

  function Item({ id }) {
    const renders = useRef(0)
    renders.current += 1

    const items = useSelector(
      () => {
        if (id === 1) {
          return [1, 2, 3]
        } else {
          return [count(), count(), count()]
        }
      },
      [id],
      { label: 'sel-item' + id },
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
    </Provider>,
  )

  t.is(container.querySelector('.item-1').innerHTML, '1,2,3: 1')
  t.is(container.querySelector('.item-2').innerHTML, '0,0,0: 1')

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

test('selector family', async (t) => {
  const counter = atom(21, { label: 'counter' })
  const times = selector((multi) => counter() * multi, { label: 'times' })

  function App() {
    const double = useSelector(() => times(2), [], { label: 'double' })
    const triple = useSelector(() => times(3), [], { label: 'triple' })

    return (
      <div>
        <div className='content-1'>{double}</div>
        <div className='content-2'>{triple}</div>
      </div>
    )
  }

  let store
  const { container, unmount } = render(
    <Provider getAtomStates={(store_, getState_) => (store = store_)}>
      <App />
    </Provider>,
  )

  t.deepEqual(mounted(store), ['double', 'times', 'counter', 'triple'])

  t.is(container.querySelector('.content-1').innerHTML, '42')
  t.is(container.querySelector('.content-2').innerHTML, '63')

  const timesAtom = Array.from(store.values()).find((a) => a.label === 'times')
  t.deepEqual(Array.from(timesAtom.memo.keys()), [2, 3])

  unmount()

  t.deepEqual(mounted(store), ['counter'])
})

function mounted(atomStates) {
  return getState(atomStates).map((a) => a.label)
}

function getState(atomStates) {
  return Array.from(atomStates.values())
}
