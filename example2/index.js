import React from 'react'
import ReactDOM from 'react-dom'
import { Provider, atom, reducer, selector, useValue, useSet, useSelector } from '../src'
import './styles.css'

// atoms
const counter = atom(0, { label: 'counter' })

// selectors
const double = selector((get) => get(counter) * 2, { label: 'double' })

// selector family
// counst times = selectorFamily(t => get => get(counter) * t)

// actions
const useInc = reducer(counter, (state, payload) => state + 1)

function App() {
  // selecting atom
  const val = useValue(counter)

  // // selecting selector
  const dub = useValue(double)

  // inline selector
  const trip = useSelector((get) => get(counter) * 3 + dub, [dub])

  // selecting atom with sub - selector
  // const quad = useValue(counter, (state) => state * 4)

  // action
  const inc = useInc()

  // return (
  //   <div>
  //     {val} / {dub} / {trip} / {quad} <button onClick={inc}>Increment</button>
  //   </div>
  // )

  return (
    <div>
      Value: {val} / {dub} / {trip} <button onClick={inc}>Increment</button>
      {val > 3 ? null : <Nesting />}
    </div>
  )
}

const nested = atom(Math.random())

function Nesting() {
  const val = useValue(nested)
  console.log('Rendering <Nesting />')
  return (
    <div>
      <div>Top: {val}</div>
      <NestedChild1 />
    </div>
  )
}

function NestedChild1() {
  const val = useValue(nested)
  console.log('Rendering <NestedChild2 />')
  return (
    <div>
      <div>NestedChild1: {val}</div>
      <NestedChild2 />
    </div>
  )
}

function NestedChild2() {
  const val = useValue(nested)
  const update = useSet(nested)
  console.log('Rendering <NestedChild2 />')
  return (
    <div>
      <div>NestedChild2: {val}</div>
      <button onClick={() => update(Math.random())}>Increment</button>
    </div>
  )
}

ReactDOM.render(
  <Provider>
    <App />
  </Provider>,
  document.querySelector('#root')
)
