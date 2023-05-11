/* eslint-disable react/jsx-no-bind */

import React, { useState, useEffect, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { Provider, atom, selector, useValue, useSet } from '../src'
import './styles.css'

const counter = atom(0)
const double = selector((get) => get(counter) * 2)

function App() {
  const val = useValue(counter)
  const dub = useValue(double)
  const set = useSet(counter)
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
  document.querySelector('#root')
)
