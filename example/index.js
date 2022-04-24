/* eslint-disable react/jsx-no-bind */

import React, { useState, useEffect, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { atom, action, useValue } from '../src'
import './styles.css'

const counter = atom(0)
const useInc = action(() => state => state + 1)

const double = selector(get => get(counter) * 2)

function App() {
  const val = useValue(counter)
  const dub = useValue(double)
  const inc = useInc(counter)
  return <div>{val} / {dub} <button onClick={inc}>Increment</button></div>
}

ReactDOM.render(<App />, document.querySelector('#root'))
