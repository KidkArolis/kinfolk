import React, { createContext, useState, useEffect, useContext, useMemo, useSyncExternalStore } from 'react'

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
  a global atomMetaMap keyed by a unique atomRef for
  each atom created

  in conclusion, we have

  atomMetaMap: atomRef -> atomMeta (global)
  store: atomRef -> atom (per Provider)
 
 */

/**
 * A map of atomRef -> atomMeta storing all atomMetas
 * ever created. Automatically cleans up if the atomRef
 * is released.
 */
const atomMetaMap = new WeakMap()

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

function subscribe(store, atomRef, fn) {
  const atom = store.get(atomRef)
  atom.listeners.add(fn)
  return function unsubscribe() {
    atom.listeners.delete(fn)
  }
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

function unmount(store, atomRef) {
  const atom = store.get(atomRef)

  if (atom) {
    if (!atom.dependents.length) {
      // console.log('Unmounting', atom)
      getter(store, atomRef)
      store.delete(atomRef)
      atom.dependencies.forEach((depRef) => {
        // console.log(store.get(depRef))
        unmount(store, depRef)
      })
    }
  }
}

export function useValue(atomRef) {
  const store = useContext(AtomContext)

  mount(store, atomRef)
  useEffect(() => {
    return () => {
      unmount(store, atomRef)
    }
  }, [])

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
    mount(store, upstreamAtomRef)
    // useEffect(() => {
    //   return () => {
    //     unmount(store, upstreamAtomRef)
    //   }
    // }, [])

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

export function useSet(atomRef) {
  const store = useContext(AtomContext)

  mount(store, atomRef)
  useEffect(() => {
    return () => {
      unmount(store, atomRef)
    }
  }, [])

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

export function useSelector(selectorFn, deps = []) {
  const selected = useMemo(() => selector(selectorFn), deps)
  return useValue(selected)
}

export function actions(atomRef, actions) {
  return function useActions() {
    const set = useSet(atomRef)
    return useMemo(() => {
      return Object.keys(actions).reduce((acc, name) => {
        acc[name] = (...args) => {
          set((state) => actions[name](state, ...args))
        }
        return acc
      }, {})
    }, [set])
  }
}
