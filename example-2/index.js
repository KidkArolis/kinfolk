import React from 'react'
import { createRoot } from 'react-dom/client'
import {
  Provider,
  atom,
  selector,
  useSelector,
  useSetter,
  useReducer,
} from '../src/kinfolk.js'
import './styles.css'

// atoms
const counter = atom(0)

// selectors
const double = selector(() => counter() * 2)

// selector families
const times = selector((t) => counter() * t)

// updates
const increment = (state, payload) => state + 1

function App() {
  const shouldShowNesting = useSelector(() => counter() <= 3, [])
  return (
    <>
      <Increments />
      {shouldShowNesting > 3 ? null : <Nesting />}
    </>
  )
}

function Increments() {
  // selecting atom
  const val = useSelector(() => counter(), [])

  // selecting selector
  const dub = useSelector(() => double(), [])

  // selecting selector family
  const tim4 = useSelector(() => times(4), [])
  const tim5 = useSelector(() => times(5), [])

  // selector with deps
  const trip = useSelector(() => counter() * 3 + dub, [dub])

  // reducer
  const inc = useReducer(counter, increment)

  return (
    <div className='box'>
      <div>
        Value: {val} / {dub} / {trip} / {tim4} / {tim5}
      </div>
      <button onClick={() => inc()}>Increment</button>
    </div>
  )
}

const nested = atom(Math.random())

function Nesting() {
  const val = useSelector(() => nested())
  console.log('Rendering <Nesting />')
  return (
    <div className='box'>
      <div>Top: {val}</div>
      <NestedChild1 />
    </div>
  )
}

function NestedChild1() {
  const val = useSelector(() => nested())
  console.log('Rendering <NestedChild2 />')
  return (
    <div>
      <div>NestedChild1: {val}</div>
      <NestedChild2 />
    </div>
  )
}

function NestedChild2() {
  const val = useSelector(() => nested())
  const update = useSetter(nested)
  console.log('Rendering <NestedChild2 />')
  return (
    <div>
      <div>NestedChild2: {val}</div>
      <button onClick={() => update(Math.random())}>Update</button>
    </div>
  )
}

createRoot(document.querySelector('#root')).render(
  <Provider getAtomStates={(store) => (window.store = store)}>
    <App />
  </Provider>,
)
