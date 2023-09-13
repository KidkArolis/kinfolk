/* eslint-disable react/jsx-no-bind */

import React from 'react'
import { createRoot } from 'react-dom/client'
import {
  Provider,
  atom,
  selector,
  useSelector,
  useSetter,
} from '../src/kinfolk.js'
import './styles.css'

const counter = atom(0, { label: 'counter' })
const double = selector(() => counter() * 2, { label: 'double' })

function App() {
  const val = useSelector(counter, [])
  const dub = useSelector(double, [])
  const set = useSetter(counter)
  return (
    <div>
      {val} / {dub} <button onClick={() => set(val + 1)}>Increment</button>
    </div>
  )
}

createRoot(document.querySelector('#root')).render(
  <Provider>
    <App />
  </Provider>,
)
