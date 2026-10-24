import { test, expect } from 'vitest'
import { atom, selector, createStore } from '../src/kinfolk'

test('symbol properties participate in shallow equality', () => {
  const key = Symbol('value')
  const store = createStore()
  const count = atom(0)
  const selected = selector(() => ({ [key]: count() }))
  expect(store.get(selected)[key]).toBe(0)
  store.set(count, 1)
  expect(store.get(selected)[key]).toBe(1)
})

test('missing and present undefined properties differ', () => {
  const store = createStore()
  const tick = atom(false)
  const selected = selector(() => (tick() ? {} : { value: undefined }))
  expect(Object.hasOwn(store.get(selected), 'value')).toBe(true)
  store.set(tick, true)
  expect(Object.hasOwn(store.get(selected), 'value')).toBe(false)
})

test('symbol keys are compared by identity', () => {
  const firstKey = Symbol('same description')
  const secondKey = Symbol('same description')
  const store = createStore()
  const tick = atom(false)
  const selected = selector(() => ({ [tick() ? secondKey : firstKey]: 1 }))
  const first = store.get(selected)
  store.set(tick, true)
  const next = store.get(selected)
  expect(next).not.toBe(first)
  expect(next[secondKey]).toBe(1)
  expect(Object.hasOwn(next, firstKey)).toBe(false)
})

test('equal symbol values reuse their result', () => {
  const key = Symbol('value')
  const store = createStore()
  const tick = atom(0)
  const selected = selector(() => {
    tick()
    return { [key]: 1 }
  })
  const first = store.get(selected)
  store.set(tick, 1)
  expect(store.get(selected)).toBe(first)
})

test('nonenumerable properties and inherited values do not invalidate results', () => {
  const hidden = Symbol('hidden')
  const store = createStore()
  const tick = atom(0)
  const selected = selector(() => {
    const value = tick()
    return Object.defineProperties(Object.create({ inherited: value }), {
      visible: { value: 1, enumerable: true },
      hidden: { value },
      [hidden]: { value },
    })
  })
  const first = store.get(selected)
  store.set(tick, 1)
  expect(store.get(selected)).toBe(first)
})

test('enumerability changes cannot hide a different enumerable key', () => {
  const store = createStore()
  const tick = atom(false)
  const selected = selector(() =>
    tick()
      ? Object.defineProperty({ other: 2 }, 'value', { value: 1 })
      : { value: 1 },
  )
  const first = store.get(selected)
  store.set(tick, true)
  const next = store.get(selected)
  expect(next).not.toBe(first)
  expect(Object.keys(next)).toEqual(['other'])
})
