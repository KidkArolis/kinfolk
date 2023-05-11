import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react'

/**
  atomRef
  -------
  When you create atom with atom(), you get a reference which we cann atomRef
  internally in the implementation. We'll use atomRef to store atom's metadata
  such as initial state, and atom's state such as the current value for the
  current context.

  atomMeta
  --------
  When we create an atom, we pass initial state and other config - we call
  this atomMeta and store in a global meta map keyed by a unique atomRef for
  each atom created.

  atomState
  ---------
  Atom state is lazily initialised upon interacting with the atom for the
  first time with a hook. We store store this state in a Map in React context.

  in conclusion, we have

  atomMetas: atomRef -> atomMeta (global)
  atomStates: atomRef -> atomState (per Provider)
 
 */

/**
 * A map of atomRef -> atomMeta storing all atomMetas ever created.
 */
const atomMetas = new WeakMap()

/**
 * Context is where we keep the store of atoms for each
 * different React subtree, typically you'll use one only
 * but you can use multiple ones.
 */
const AtomContext = createContext()

/**
 * Provider stores the state of the atoms to be shared
 * within the wrapped application or subtree.
 */
export function Provider({ children, onMount }) {
  const [atomStates] = useState(() => new Map())

  useEffect(() => {
    onMount && onMount(atomStates)
  }, [onMount])

  return <AtomContext.Provider value={atomStates}>{children}</AtomContext.Provider>
}

export function atom(initialState, { label } = {}) {
  const atomRef = Object.freeze(label ? { label } : {})
  const atomMeta = { initialState }
  atomMetas.set(atomRef, atomMeta)
  return atomRef
}

export function selector(selector, { label, equal } = {}) {
  const selectorRef = Object.freeze(label ? { label } : {})
  const selectorMeta = { selector, equal }
  atomMetas.set(selectorRef, selectorMeta)
  return selectorRef
}

// TODO??
export function selectorFamily(selectorFamily, { label, equal } = {}) {
  const selectorFamilyRef = Object.freeze(label ? { label } : {})
  const selectorFamilyMemo = new Map()
  const selectorFamilyMeta = { selectorFamily, equal, selectorFamilyMemo }
  atomMetas.set(selectorFamilyRef, selectorFamilyMeta)

  return (...args) => {
    let sel = selectorFamilyMemo
    for (const arg of args) {
      if (sel) {
        sel = sel.get(arg)
      } else {
        sel = undefined
      }
    }

    if (sel) {
      return sel
    }

    sel = selector(selectorFamily(...args), { label, equal })

    let l = selectorFamilyMemo
    for (let i = 0; i < args.length - 1; i++) {
      const arg = args[i]
      if (!l.has(arg)) {
        l.set(arg, new Map())
      }
      l = l.get(arg)
    }
    l.set(args[args.length - 1], sel)

    return sel
  }
}

function mount(store, atomRef) {
  // already mounted
  if (store.has(atomRef)) {
    return store.get(atomRef)
  }

  const atomMeta = atomMetas.get(atomRef)
  const atom = {
    state: null,
    listeners: new Set(),
    dependents: [],
    dependencies: [],
  }
  if (atomRef.label) {
    atom.label = atomRef.label
  }
  if (atomMeta.equal) {
    atom.equal = atomMeta.equal
  }
  store.set(atomRef, atom)

  if (has(atomMeta, 'initialState')) {
    atom.state = atomMeta.initialState
  }

  if (atomMeta.selector) {
    atom.selector = atomMeta.selector
    atom.state = select(store, atomRef)
  }

  if (atomMeta.selectorFamily) {
    atom.selectorFamily = atomMeta.selectorFamily
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
    dependencies.forEach(depRef => {
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

  if (atom.selector) {
    return atom.selector(get)
  }

  if (atom.selectorFamily) {
    return atom.selectorFamily
  }
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
    upstreamAtom.dependents = upstreamAtom.dependents.filter(dependent => {
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
  return upstreamAtomRef => {
    if (!upstreamAtomRef) {
      throw new Error('No atom/selector passed to the get() call')
    }

    mount(store, upstreamAtomRef)

    // track dependencies
    if (!atom.dependencies.includes(upstreamAtomRef)) {
      atom.dependencies.push(upstreamAtomRef)
    }

    // and dependents
    const upstreamAtom = store.get(upstreamAtomRef)
    const dependents = upstreamAtom.dependents
    const existingDependent = dependents.find(d => d.atomRef === atomRef)
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
    const eq = atom.equal || Object.is
    if (eq(curr, atom.state)) return
  }

  atom.listeners.forEach(l => l(atom.state))
  atom.dependents.forEach(d => notify(store, d.atomRef))
}

/**
 * Hook to subscribe to atom's value
 */
export function useValue(atomRef) {
  const store = useContext(AtomContext)

  const { sub, getSnapshot } = useMemo(() => {
    const sub = cb => subscribe(store, atomRef, cb)
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
export function useSetter(atomRef) {
  const store = useContext(AtomContext)

  useEffect(() => {
    mount(store, atomRef)
    return () => {
      unmount(store, atomRef)
    }
  }, [atomRef])

  return state => {
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

  return useCallback(
    action => {
      const atom = store.get(atomRef)
      const curr = atom.state
      atom.state = reducer(atom.state, action)
      if (curr !== atom.state) {
        notify(store, atomRef)
      }
    },
    [reducer]
  )
}

/**
 * Hook to create an inline selector
 */
export function useSelector(selectorFn, deps, equal) {
  const initialised = useRef(false)
  const [sel, setSelector] = useState(() => selector(selectorFn, { equal }))

  useEffect(() => {
    if (initialised.current) {
      setSelector(selector(selectorFn, { equal }))
    }
    initialised.current = true
  }, deps)

  return useValue(sel)
}

function has(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key)
}
