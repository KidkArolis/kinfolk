/* eslint-disable react/jsx-no-bind */

import React from 'react'
import ReactDOM from 'react-dom'
import {
  Provider,
  atom,
  selector,
  useSelector,
  useSetter,
} from '../src/kinfolk.js'
import './styles.css'

const counter = atom(0)
const double = selector(() => counter() * 2)

function App() {
  const val = useSelector(() => counter())
  const dub = useSelector(() => double())
  const set = useSetter(counter)
  return (
    <div>
      {val} / {dub} <button onClick={() => set(val + 1)}>Increment</button>
    </div>
  )
}

ReactDOM.render(
  <Provider>
    <App />
  </Provider>,
  document.querySelector('#root'),
)
