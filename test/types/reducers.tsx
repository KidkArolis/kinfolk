import { atom, createContext, useReducer } from '../../src/kinfolk'

const counter = atom(0)

function Component() {
  const increment = useReducer(counter, (state) => state + 1)
  increment()
  // @ts-expect-error Actionless reducers do not accept arbitrary actions.
  increment('unexpected')

  const dispatch = useReducer(
    counter,
    (state, amount: number) => state + amount,
  )
  dispatch(2)
  // @ts-expect-error Actionful reducers still require an action.
  dispatch()
  // @ts-expect-error Actionful reducers retain their action type.
  dispatch('wrong')

  const isolated = createContext()
  const decrement = isolated.useReducer(counter, (state) => state - 1)
  decrement()
  return null
}

void Component
