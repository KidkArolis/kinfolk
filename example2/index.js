import React from 'react'
import ReactDOM from 'react-dom'
import { Provider, atom, reducer, selector, selectorFamily, useValue, useSetter, useSelector, useReducer } from '../src'
import './styles.css'

// atoms
const counter = atom(0)

// selectors
const double = selector((get) => get(counter) * 2)

// selector family
const times = selectorFamily((t) => (get) => get(counter) * t)

// updates
const increment = (state, payload) => state + 1

function App() {
  // selecting atom
  const val = useValue(counter)

  // selecting selector
  const dub = useValue(double)

  // inline selector
  const trip = useSelector((get) => get(counter) * 3 + dub, [dub])

  // reducer
  const inc = useReducer(counter, increment)

  return (
    <div>
      Value: {val} / {dub} / {trip} <button onClick={() => inc()}>Increment</button>
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
  const update = useSetter(nested)
  console.log('Rendering <NestedChild2 />')
  return (
    <div>
      <div>NestedChild2: {val}</div>
      <button onClick={() => update(Math.random())}>Update</button>
    </div>
  )
}

ReactDOM.render(
  <Provider onMount={(store) => (window.store = store)}>
    <App />
  </Provider>,
  document.querySelector('#root')
)
