import React from 'react'
import { afterEach, expect, test } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { atom, createStore, Provider, useSelector } from '../src/kinfolk'

afterEach(cleanup)

test.each([false, true])(
  'selector options update for callback=%s',
  (callback) => {
    const store = createStore()
    const value = atom({ count: 1, tag: 'a' })
    const read = callback ? () => value() : value
    const sameCount = (a, b) => a.count === b.count
    const hook = renderHook(
      ({ equal, label }) => useSelector(read, { deps: [], equal, label }),
      {
        initialProps: { equal: sameCount, label: 'before' },
        wrapper: ({ children }) => (
          <Provider store={store}>{children}</Provider>
        ),
      },
    )
    act(() => store.set(value, { count: 1, tag: 'b' }))
    expect(hook.result.current.tag).toBe('a')
    hook.rerender({ equal: Object.is, label: 'after' })
    expect(hook.result.current.tag).toBe('b')
    expect(store.debug().__selectors.after).toBeDefined()
    expect(store.debug().__selectors.before).toBeUndefined()
    act(() => store.set(value, { count: 1, tag: 'c' }))
    expect(hook.result.current.tag).toBe('c')
  },
)
