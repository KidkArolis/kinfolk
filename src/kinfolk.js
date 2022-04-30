import React, { createContext, useState, useEffect, useContext, useMemo, useRef, useSyncExternalStore } from 'react'

/**
  atom
  ----
  atoms are lazily created upon interacting with them
  for the first time and are stored in a Map in the context
  they don't get used directly and are instead interacted
  with via hooks

  atomRef
  -------
  each atom is referenced by a unique atomRef

  atomMeta
  --------
  when we create an atom, we pass initial state and
  other config - we call this atomMeta and store in
  a global meta map keyed by a unique atomRef for
  each atom created

  in conclusion, we have

  meta: atomRef -> atomMeta (global)
  store: atomRef -> atom (per Provider)
 
 */

/**
 * A map of atomRef -> atomMeta storing all atomMetas
 * ever created. Automatically cleans up if the atomRef
 * is released.
 */
const meta = new WeakMap()

/**
 * Context is where we keep the store of atoms for each
 * different React subtree, typically you'll use one only
 * but you can use multiple ones.
 */
const AtomContext = createContext()

/**
 * Provider wraps the application or a subtree so that
 * all hooks could be used within that subtree.
 */
export function Provider({ children, onMount }) {
  const [store] = useState(() => new Map())

  useEffect(() => {
    const getState = () => Array.from(store.values())
    onMount && onMount(store, getState)
  }, [])

  return <AtomContext.Provider value={store}>{children}</AtomContext.Provider>
}

export function atom(initialState, { label = '_' } = {}) {
  const atomRef = Object.freeze({ label })
  const atomMeta = { initialState }
  meta.set(atomRef, atomMeta)
  return atomRef
}

export function selector(selector, { label = '_', equal } = {}) {
  const atomRef = Object.freeze({ label })
  const atomMeta = { selector, equal }
  meta.set(atomRef, atomMeta)
  return atomRef
}

export function selectorMap(selector, { label = '_' } = {}) {
  return selector(selector, { label, equal: shallowMapEquals })
}

export function selectorList(selector, { label = '_' } = {}) {
  return selector(selector, { label, equal: shallowListEquals })
}

function mount(store, atomRef) {
  // already mounted
  if (store.has(atomRef)) {
    return store.get(atomRef)
  }

  const atomMeta = meta.get(atomRef)
  const atom = {
    label: atomRef.label,
    state: null,
    listeners: new Set(),
    dependents: [],
    dependencies: [],
    equal: atomMeta.equal || Object.is,
  }
  store.set(atomRef, atom)

  if (has(atomMeta, 'initialState')) {
    atom.state = atomMeta.initialState
  }

  if (atomMeta.selector) {
    atom.selector = atomMeta.selector
    atom.state = select(store, atomRef)
  }

  return store.get(atomRef)
}

function unmount(store, atomRef) {
  const atom = store.get(atomRef)

  if (atom && !atom.dependents.length) {
    const dependencies = atom.dependencies

    // invoke getter to clear dependencies
    getter(store, atomRef)

    // delete atom since nobody is using it anymore
    store.delete(atomRef)

    // and walk the dependency tree down to
    // clean them up also
    dependencies.forEach((depRef) => {
      unmount(store, depRef)
    })
  }
}

/**
 * Listen to atom changes
 */
function subscribe(store, atomRef, fn) {
  const atom = store.get(atomRef)
  atom.listeners.add(fn)
  return function unsubscribe() {
    atom.listeners.delete(fn)
  }
}

/**
 * Computes the selector, updates the dependency
 * graph in the store while doing so.
 */
function select(store, atomRef) {
  const atom = store.get(atomRef)
  const get = getter(store, atomRef)
  return atom.selector(get)
}

/**
 * Getter is how selectors can be used to construct
 * a memoised computations that are only updated
 * if the depdendencies update.
 */
function getter(store, atomRef) {
  // cleanup
  const atom = store.get(atomRef)
  for (const upstreamAtomRef of atom.dependencies) {
    const upstreamAtom = store.get(upstreamAtomRef)
    upstreamAtom.dependents = upstreamAtom.dependents.filter((dependent) => {
      if (dependent.atomRef !== atomRef) {
        return true
      } else {
        dependent.count -= 1
        return dependent.count > 0
      }
    })
  }
  atom.dependencies = []

  // provide a new getter that will re-track the dependencies
  return (upstreamAtomRef) => {
    mount(store, upstreamAtomRef)

    // track dependencies
    if (!atom.dependencies.includes(upstreamAtomRef)) {
      atom.dependencies.push(upstreamAtomRef)
    }

    // and dependents
    const upstreamAtom = store.get(upstreamAtomRef)
    const dependents = upstreamAtom.dependents
    const existingDependent = dependents.find((d) => d.atomRef === atomRef)
    if (existingDependent) {
      existingDependent.count += 1
    } else {
      upstreamAtom.dependents.push({ count: 1, atomRef })
    }
    return upstreamAtom.state
  }
}

/**
 * Notify listeners of atom's update
 */
function notify(store, atomRef) {
  const atom = store.get(atomRef)

  if (atom.selector) {
    const curr = atom.state
    atom.state = select(store, atomRef)
    if (atom.equal(curr, atom.state)) return
  }

  atom.listeners.forEach((l) => l(atom.state))
  atom.dependents.forEach((d) => notify(store, d.atomRef))
}

/**
 * Hook to subscribe to atom's value
 */
export function useValue(atomRef) {
  const store = useContext(AtomContext)

  const { sub, getSnapshot } = useMemo(() => {
    const sub = (cb) => subscribe(store, atomRef, cb)
    const getSnapshot = () => {
      return mount(store, atomRef).state
    }
    return { sub, getSnapshot }
  }, [store, atomRef])

  useEffect(() => {
    return () => {
      unmount(store, atomRef)
    }
  }, [atomRef])

  return useSyncExternalStore(sub, getSnapshot)
}

/**
 * Hook to get a setter for updating atom
 */
export function useSet(atomRef) {
  const store = useContext(AtomContext)

  useEffect(() => {
    mount(store, atomRef)
    return () => {
      unmount(store, atomRef)
    }
  }, [atomRef])

  return (state) => {
    const atom = store.get(atomRef)

    const curr = atom.state

    if (typeof state === 'function') {
      atom.state = state(atom.state)
    } else {
      atom.state = state
    }

    if (curr !== atom.state) {
      notify(store, atomRef)
    }
  }
}

/**
 * Hook to get a setter for updating atom
 * using the reducer pattern
 */
export function useReducer(atomRef, reducer) {
  const store = useContext(AtomContext)

  useEffect(() => {
    mount(store, atomRef)
    return () => {
      unmount(store, atomRef)
    }
  }, [atomRef])

  return (action) => {
    const atom = store.get(atomRef)

    const curr = atom.state

    atom.state = reducer(atom.state, action)

    if (curr !== atom.state) {
      notify(store, atomRef)
    }
  }
}

/**
 * Hook to create an inline selector
 */
export function useSelector(selectorFn, deps, label, equal) {
  const initialised = useRef(false)
  const [sel, setSelector] = useState(() => selector(selectorFn, { label, equal }))

  useEffect(() => {
    if (initialised.current) {
      setSelector(selector(selectorFn, { label, equal }))
    }
    initialised.current = true
  }, deps)

  return useValue(sel)
}

export function useSelectorMap(selectorFn, deps, label) {
  return useSelector(selectorFn, deps, label, shallowMapEquals)
}

export function useSelectorList(selectorFn, deps, label) {
  return useSelector(selectorFn, deps, label, shallowListEquals)
}

/**
 * A helper for creating a set of named functions
 * that can update the atom
 */
export function actions(atomRef, actions) {
  return function useActions() {
    const set = useSet(atomRef)
    return useMemo(() => {
      return mapValues(actions, (action) => (payload) => {
        set((state) => action(state, payload))
      })
    }, [set])
  }
}

function has(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

function mapValues(obj, mapFn) {
  return Object.keys(obj).reduce((acc, key) => {
    acc[key] = mapFn(acc[key], key)
    return acc
  }, {})
}

export function shallowMapEquals(a, b) {
  if (a === b) return true
  if (!a || !b) return false
  if (!isObject(a) || !isObject(b)) return false
  for (const i in a) if (a[i] !== b[i]) return false
  for (const i in b) if (!(i in a)) return false
  return true
}

export function shallowListEquals(a, b) {
  if (a === b) return true
  if (!a || !b) return false
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function isObject(obj) {
  return typeof obj === 'object' && Object.prototype.toString.call(obj) === '[object Object]'
}
