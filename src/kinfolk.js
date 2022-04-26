import React, { createContext, useState, useContext, useMemo, useSyncExternalStore } from 'react'

/**
 * atomRef
 * -------
 * each atom is referenced by atomRef when using
 * hooks to interact with the atom
 *
 * atomMeta
 * --------
 * when we create an atom, we pass initial state and
 * various config options, we call this atomMeta and
 * store in a global atomMetaMap keyed by a unique
 * atomRef for each atom created
 *
 * atom
 * ----
 * the atom itself that is only created upon
 * interacting it the first time and is stored in
 * the context
 */

/**
 * A map of atomRef -> atomMeta storing all atomMetas
 * ever created. Automatically cleans up if the atomRef
 * is released.
 */
const atomMetaMap = new WeakMap()

/**
 * Context is where we keep the store of atoms for this
 * particular subtree.
 */
const AtomContext = createContext()

/**
 * Provider wraps the application or a subtree so that
 * all hooks could be used within that subtree.
 */
export function Provider({ children }) {
  const [context] = useState(() => {
    const store = new WeakMap()
    window.store = store
    return { store }
  })
  return <AtomContext.Provider value={context}>{children}</AtomContext.Provider>
}

function subscribe(store, atomRef, fn) {
  const atom = store.get(atomRef)
  atom.listeners.add(fn)
  return function unsubscribe() {
    atom.listeners.delete(fn)
  }
}

export function atom(initialState, { label } = {}) {
  const atomRef = {}
  if (label) atomRef.label = label
  const atomMeta = { initialState, label }
  atomMetaMap.set(atomRef, atomMeta)
  return atomRef
}

export function selector(selector, { label } = {}) {
  const atomRef = {}
  if (label) atomRef.label = label
  const atomMeta = { selector, label }
  atomMetaMap.set(atomRef, atomMeta)
  return atomRef
}

function mount(store, atomRef) {
  // already mounted
  if (store.has(atomRef)) {
    return
  }

  // initialise the atom
  const atomMeta = atomMetaMap.get(atomRef)
  const atom = {
    label: atomMeta.label,
    state: null,
    listeners: new Set(),
    dependents: [],
    dependencies: [],
  }

  store.set(atomRef, atom)

  if (Object.prototype.hasOwnProperty.call(atomMeta, 'initialState')) {
    atom.state = atomMeta.initialState
  }

  if (atomMeta.selector) {
    atom.selector = atomMeta.selector
    atom.state = select(store, atomRef)
  }
}

export function useAtom(atomRef) {
  return [useAtomValue(atomRef), useAtomSet(atomRef)]
}

export function useAtomValue(atomRef) {
  const { store } = useContext(AtomContext)

  mount(store, atomRef)

  const { sub, getSnapshot } = useMemo(() => {
    const sub = (cb) => subscribe(store, atomRef, cb)
    const getSnapshot = () => store.get(atomRef).state
    return { sub, getSnapshot }
  }, [store, atomRef])

  return useSyncExternalStore(sub, getSnapshot)
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
      dependent.count -= 1
      return dependent.count > 0
    })
  }

  // provide a new getter that will re-track the dependencies
  return (upstreamAtomRef) => {
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
    if (curr === atom.state) return
  }

  atom.listeners.forEach((l) => l(atom.state))
  atom.dependents.forEach((d) => notify(store, d.atomRef))
}

export function useAtomSet(atomRef) {
  const { store } = useContext(AtomContext)

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

export function useAtomSelector(selectorFn, deps = []) {
  const selected = useMemo(() => selector(selectorFn), deps)
  return useValue(selected)
}

export function reducer(atomRef, fn) {
  return function useReducer() {
    const set = useSet(atomRef)
    return (...args) => {
      set((state) => fn(state, ...args))
    }
  }
}
