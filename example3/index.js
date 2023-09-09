import React from 'react'
import { createRoot } from 'react-dom'
import { Provider, atom, selector, useSelector, useSetter } from '../src/kinfolk'
import './styles.css'

const counter = atom({ count: 0, unrelated: 0 }, { label: 'cache' })
const count = selector(() => counter().count, { label: 'selector-count' })

function App() {
  return (
    <>
      <Button />
      <Item />
      <Stats />
    </>
  )
}

function Button({ name }) {
  const setCounter = useSetter(counter)
  return (
    <button
      className='button'
      onClick={() => {
        setCounter((s) => ({ ...s, unrelated: s.unrelated + 1 }))
      }}
    >
      Increment
    </button>
  )
}

function Item() {
  const c = useSelector(() => count(), [], undefined, 'selector-item')
  return <div className='item'>{c}</div>
}

function Stats() {
  const c = useSelector(() => counter(), [], undefined, 'selector-stats')
  console.log(c)
  return (
    <div className='item'>
      count: {c.count} unrelated: {c.unrelated}
    </div>
  )
}

const root = createRoot(document.querySelector('#root'))
root.render(
  <Provider>
    <App />
  </Provider>
)
