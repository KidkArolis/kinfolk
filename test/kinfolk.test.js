import test from 'ava'
import { JSDOM } from 'jsdom'
import { render, fireEvent, cleanup, act } from '@testing-library/react'
import React, { useState, useEffect, useRef } from 'react'
import {
  Provider,
  createStore,
  atom,
  selector,
  useSetter,
  useReducer,
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

test('useReducer', async (t) => {
  const counter = atom(0, { label: 'counter' })
  const double = selector(() => counter() * 2, { label: 'double' })

  function count(state, action) {
    if (action === 'inc') return state + 1
    if (action === 'dec') return state - 1
    return state
  }

  function App() {
    const val1 = useSelector(() => counter(), [])
    const val2 = useSelector(() => double())
    const dispatch = useReducer(counter, count)

    return (
      <div>
        <button className='inc' onClick={() => dispatch('inc')}>
          Increment
        </button>
        <button className='dec' onClick={() => dispatch('dec')}>
          Decrement
        </button>
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
  fireEvent.click(container.querySelector('.inc'))
  t.is(container.querySelector('.content-1').innerHTML, '1')
  t.is(container.querySelector('.content-2').innerHTML, '2')
  fireEvent.click(container.querySelector('.inc'))
  t.is(container.querySelector('.content-1').innerHTML, '2')
  t.is(container.querySelector('.content-2').innerHTML, '4')
  fireEvent.click(container.querySelector('.dec'))
  t.is(container.querySelector('.content-1').innerHTML, '1')
  t.is(container.querySelector('.content-2').innerHTML, '2')
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
  const store = createStore()
  const counter1 = atom(1, { label: 'counter-1' })
  const counter2 = atom(2, { label: 'counter-2' })
  const double = selector(() => counter1() * 2, {
    label: 'counter-1-double',
    persist: false,
  })
  const triple = selector(() => counter1() * 3, {
    label: 'counter-1-triple',
    persist: true,
  })

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
        {step <= 3 && <Counter id='4' atom={triple} />}
        {step === 4 && <Counter id='5' atom={double} />}
        {step === 4 && <Inc atom={counter1} />}
      </div>
    )
  }

  const { container } = render(
    <Provider store={store}>
      <App />
    </Provider>,
  )

  // at first all 4 components are mounted
  // and so are both atoms and both selectors
  t.is(container.querySelector('.step').innerHTML, '0')
  t.is(container.querySelector('.content-1').innerHTML, '1')
  t.is(container.querySelector('.content-2').innerHTML, '2')
  t.is(container.querySelector('.content-3').innerHTML, '2')
  t.is(container.querySelector('.content-4').innerHTML, '3')
  t.is(container.querySelector('.content-5'), null)
  t.deepEqual(mounted(store), [
    'component-1',
    'counter-1',
    'component-2',
    'counter-2',
    'component-3',
    'counter-1-double',
    'component-4',
    'counter-1-triple',
  ])

  // here we unmounted the useSelector of component-1
  // but the 2 atoms and selectors are still mounted
  fireEvent.click(container.querySelector('button'))
  t.is(container.querySelector('.step').innerHTML, '1')
  t.is(container.querySelector('.content-1'), null)
  t.is(container.querySelector('.content-2').innerHTML, '2')
  t.is(container.querySelector('.content-3').innerHTML, '2')
  t.is(container.querySelector('.content-4').innerHTML, '3')
  t.is(container.querySelector('.content-5'), null)
  t.deepEqual(mounted(store), [
    'counter-1',
    'component-2',
    'counter-2',
    'component-3',
    'counter-1-double',
    'component-4',
    'counter-1-triple',
  ])

  // here we unmounted component-2 as well
  // but the 2 atoms and 2 selectors are still mounted
  // because we never unmount atoms, they're permanent state
  // and we're still using both selectors for now
  fireEvent.click(container.querySelector('button'))
  t.is(container.querySelector('.step').innerHTML, '2')
  t.is(container.querySelector('.content-1'), null)
  t.is(container.querySelector('.content-2'), null)
  t.is(container.querySelector('.content-3').innerHTML, '2')
  t.is(container.querySelector('.content-4').innerHTML, '3')
  t.is(container.querySelector('.content-5'), null)
  t.deepEqual(mounted(store), [
    'counter-1',
    'counter-2',
    'component-3',
    'counter-1-double',
    'component-4',
    'counter-1-triple',
  ])

  // here we no longer use the double selector anywhere
  // so it gets unmounted
  fireEvent.click(container.querySelector('button'))
  t.is(container.querySelector('.step').innerHTML, '3')
  t.is(container.querySelector('.content-1'), null)
  t.is(container.querySelector('.content-2'), null)
  t.is(container.querySelector('.content-3'), null)
  t.is(container.querySelector('.content-4').innerHTML, '3')
  t.is(container.querySelector('.content-5'), null)
  t.deepEqual(mounted(store), [
    'counter-1',
    'counter-2',
    'component-4',
    'counter-1-triple',
  ])

  // here we remount the double selector via 5th component
  fireEvent.click(container.querySelector('button'))
  t.is(container.querySelector('.step').innerHTML, '4')
  t.is(container.querySelector('.content-1'), null)
  t.is(container.querySelector('.content-2'), null)
  t.is(container.querySelector('.content-3'), null)
  t.is(container.querySelector('.content-4'), null)
  t.is(container.querySelector('.content-5').innerHTML, '4')
  t.deepEqual(mounted(store), [
    'counter-1',
    'counter-2',
    'counter-1-triple',
    'component-5',
    'counter-1-double',
  ])

  // and finally nothing is used, so everything gets unmounted
  // but the 2 atoms and the triple selector are persistent
  fireEvent.click(container.querySelector('button'))
  t.is(container.querySelector('.step').innerHTML, '5')
  t.is(container.querySelector('.content-1'), null)
  t.is(container.querySelector('.content-2'), null)
  t.is(container.querySelector('.content-3'), null)
  t.is(container.querySelector('.content-4'), null)
  t.is(container.querySelector('.content-5'), null)
  t.deepEqual(mounted(store), ['counter-1', 'counter-2', 'counter-1-triple'])
})

test('inline selector', async (t) => {
  const store = createStore()
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

  const { container } = render(
    <Provider store={store}>
      <App />
    </Provider>,
  )

  t.is(container.querySelector('.content-1').innerHTML, '4')
  t.deepEqual(
    mounted(store).map((a) => a.replace(/\d+$/g, 'X')),
    ['selectorX', 'counter'],
  )

  fireEvent.click(container.querySelector('button'))
  t.is(container.querySelector('.content-1').innerHTML, '6')
  t.deepEqual(
    mounted(store).map((a) => a.replace(/\d+$/g, 'X')),
    ['counter', 'selectorX'],
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
  const store = createStore()
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

  const { container, unmount } = render(
    <Provider store={store}>
      <App />
    </Provider>,
  )

  t.deepEqual(mounted(store), ['double', 'times', 'counter', 'triple'])

  t.is(container.querySelector('.content-1').innerHTML, '42')
  t.is(container.querySelector('.content-2').innerHTML, '63')

  const timesAtom = Array.from(store.atomStates.values()).find(
    (a) => a.label === 'times',
  )
  t.deepEqual(Array.from(timesAtom.memo.keys()), [2, 3])

  unmount()

  t.deepEqual(mounted(store), ['times', 'counter'])
})

test('updating atoms via store', async (t) => {
  const store = createStore()
  const counter = atom(0, { label: 'counter' })
  const double = selector(() => counter() * 2, { label: 'double' })
  const nth = selector((n) => counter() * n, { label: 'nth' })

  function App() {
    const val1 = useSelector(() => counter(), [], { label: 'val1' })
    const val2 = useSelector(() => double(), undefined, { label: 'val2' })
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
    <Provider store={store}>
      <App />
    </Provider>,
  )

  t.is(container.querySelector('.content-1').innerHTML, '0')
  t.is(container.querySelector('.content-2').innerHTML, '0')
  fireEvent.click(container.querySelector('button'))
  t.is(container.querySelector('.content-1').innerHTML, '1')
  t.is(container.querySelector('.content-2').innerHTML, '2')

  t.is(store.get(counter), 1)
  t.is(store.get(double), 2)
  t.is(store.get(nth, 1), 1)
  t.is(store.get(nth, 5), 5)

  act(() => {
    store.set(counter, 5)
  })
  t.is(store.get(counter), 5)
  t.is(store.get(double), 10)
  t.is(store.get(nth, 1), 5)
  t.is(store.get(nth, 5), 25)

  act(() => {
    store.set(counter, (curr) => curr + 1)
  })
  t.is(store.get(counter), 6)
  t.is(store.get(double), 12)
  t.is(store.get(nth, 1), 6)
  t.is(store.get(nth, 5), 30)

  const d = store.debug()
  const __selectors = Object.keys(d.__selectors)
  delete d.__selectors
  t.deepEqual(d, { counter: 6 })
  t.deepEqual(__selectors, ['val1', 'double', 'nth', 'val2'])
})

test('useSelector will memo values using a shallow comparator by default', async (t) => {
  const store = createStore()
  const counter = atom(0, { label: 'counter' })

  function App() {
    return (
      <>
        <Button />
        <Item />
      </>
    )
  }

  function Button() {
    const setCounter = useSetter(counter)
    return <button onClick={() => setCounter((s) => s + 1)}>Next step</button>
  }

  function Item() {
    const renders = useRef(0)
    renders.current += 1

    const case1 = useSelector(() => (counter() < 3 ? 'a' : 'b'), [])
    const case2 = useSelector(
      () => (counter() < 3 ? { a: 1, b: 2 } : { a: 1 }),
      [],
    )
    const case3 = useSelector(() => (counter() < 3 ? [1, 2, 3] : [1, 2]), [])

    return (
      <div className='item'>
        <div className='case1'>{case1}</div>
        <div className='case2'>{JSON.stringify(case2)}</div>
        <div className='case3'>{JSON.stringify(case3)}</div>
        <div className='renderCount'>{renders.current}</div>
      </div>
    )
  }

  const { container } = render(
    <Provider store={store}>
      <App />
    </Provider>,
  )

  t.is(store.get(counter), 0)
  t.is(container.querySelector('.case1').innerHTML, 'a')
  t.is(container.querySelector('.case2').innerHTML, '{"a":1,"b":2}')
  t.is(container.querySelector('.case3').innerHTML, '[1,2,3]')
  t.is(container.querySelector('.renderCount').innerHTML, '1')

  fireEvent.click(container.querySelector('button'))
  t.is(store.get(counter), 1)
  t.is(container.querySelector('.case1').innerHTML, 'a')
  t.is(container.querySelector('.case2').innerHTML, '{"a":1,"b":2}')
  t.is(container.querySelector('.case3').innerHTML, '[1,2,3]')
  t.is(container.querySelector('.renderCount').innerHTML, '1')

  fireEvent.click(container.querySelector('button'))
  t.is(store.get(counter), 2)
  t.is(container.querySelector('.case1').innerHTML, 'a')
  t.is(container.querySelector('.case2').innerHTML, '{"a":1,"b":2}')
  t.is(container.querySelector('.case3').innerHTML, '[1,2,3]')
  t.is(container.querySelector('.renderCount').innerHTML, '1')

  fireEvent.click(container.querySelector('button'))
  t.is(store.get(counter), 3)
  t.is(container.querySelector('.case1').innerHTML, 'b')
  t.is(container.querySelector('.case2').innerHTML, '{"a":1}')
  t.is(container.querySelector('.case3').innerHTML, '[1,2]')
  t.is(container.querySelector('.renderCount').innerHTML, '2')
})

function mounted(store) {
  const atomStates = Array.from(store.atomStates.values())
  return atomStates.map((a) => a.label)
}
