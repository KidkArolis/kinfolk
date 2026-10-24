const assert = require('node:assert/strict')
const React = require('react')
const { renderToString } = require('react-dom/server')

module.exports = function check({
  atom,
  selector,
  createStore,
  Provider,
  useSelector,
  useSetter,
  useReducer,
}) {
  const count = atom(2)
  const multiple = selector((factor = 2) => ({ value: count() * factor }))
  const store = createStore()
  store.set(count, 4)
  const cached = store.get(multiple)
  assert.deepEqual(cached, { value: 8 })
  assert.deepEqual(store.get(multiple, 3), { value: 12 })
  store.clearCache(multiple, undefined)
  assert.notEqual(store.get(multiple), cached)

  function Counter() {
    const value = useSelector(count)
    const doubled = useSelector(multiple)
    const set = useSetter(count)
    const increment = useReducer(count, (n) => n + 1)
    assert.equal(typeof set, 'function')
    assert.equal(typeof increment, 'function')
    return React.createElement(
      'button',
      { onClick: increment },
      `${value}/${doubled.value}`,
    )
  }
  const html = renderToString(
    React.createElement(Provider, { store }, React.createElement(Counter)),
  )
  assert.equal(html, '<button>4/8</button>')
}
