import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from 'react'

/**
  atomRef
  -------
  When you create an atom with atom(), you get a reference which we call atomRef
  internally in the implementation. We'll use atomRef as the key to store atom's
  metadata such as initial state in atomMetas (global) and atom's current state
  and dependencies in atomStates (Provider).

  atomMeta
  --------
  When we create an atom, we pass initial state and other config - we call
  this atomMeta and store in a global meta map keyed by a unique atomRef for
  each atom (and selector) created.

  atomState
  ---------
  Atom state is lazily initialised upon interacting with the atom for the
  first time with a hook. We store this state in a Map in React context.

  In summary, we have:

  - calling atom() returns an atomRef
  - atomMetas is a map of atomRef -> atomMeta (global)
  - atomStates is a map of atomRef -> atomState (per Provider)

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

/*
 * Indices for default atom and selector labeling
 */
let atomLabel = 0
let selectorLabel = 0

/**
 * Machinery to allow reading and subscribing to atoms
 * and selectors inside other selectors
 */
const defaultGet = () => assert(false, 'Atoms can only be read in selectors')
const __getters = [defaultGet]
const __get = (...args) => __getters[__getters.length - 1](...args)

function withGetter(get, fn) {
  __getters.push(get)
  const val = fn()
  __getters.pop()
  return val
}

function evaluateSelectorFn(atomStates, atomRef, arg) {
  const atom = atomStates.get(atomRef)

  // untrack the dependencies of this atom
  for (const parentAtomRef of atom.parents) {
    const parentAtom = atomStates.get(parentAtomRef)
    parentAtom.children.delete(atomRef)
  }
  atom.parents.clear()

  // create a getter able to track the dependencies
  const inputs = []
  const get = (parentAtomRef, arg) => {
    // track the dependency tree
    const parentAtom = init(atomStates, parentAtomRef)
    atom.parents.add(parentAtomRef)
    parentAtom.children.add(atomRef)

    // compute the value and keep track of inputs
    const value = getSnapshot(atomStates, parentAtomRef, arg)
    inputs.push({ atomRef: parentAtomRef, arg, value })
    return value
  }
  const val = withGetter(get, () => atom.selectorFn(arg))

  return [val, inputs]
}

/**
 * Provider stores the state of the atoms to be shared
 * within the wrapped subtree.
 */
export function Provider({ children, getAtomStates }) {
  const [atomStates] = useState(() => new Map())

  useEffect(() => {
    getAtomStates && getAtomStates(atomStates)
  }, [atomStates, getAtomStates])

  return (
    <AtomContext.Provider value={atomStates}>{children}</AtomContext.Provider>
  )
}

export function atom(initialState, { label } = {}) {
  const atomRef = () => __get(atomRef)
  if (label) atomRef.label = label
  const atomMeta = { initialState }
  atomMetas.set(atomRef, atomMeta)
  return atomRef
}

export function selector(selectorFn, { label, equal } = {}) {
  const selectorRef = (arg) => __get(selectorRef, arg)
  if (label) selectorRef.label = label
  const selectorMeta = { selectorFn, equal }
  atomMetas.set(selectorRef, selectorMeta)
  return selectorRef
}

function init(atomStates, atomRef) {
  if (!atomStates.has(atomRef)) {
    const atomMeta = atomMetas.get(atomRef)

    const atom = {
      state: null,
      listeners: new Set(),
      parents: new Set(),
      children: new Set(),
      label: atomRef.label,
    }

    if (has(atomMeta, 'initialState')) {
      atom.state = atomMeta.initialState
    }

    if (has(atomMeta, 'selectorFn')) {
      atom.selectorFn = atomMeta.selectorFn
      atom.equal = atomMeta.equal || Object.is
      atom.memo = new Map()
      atom.label = atom.label || `selector-${++selectorLabel}`
    } else {
      atom.label = atom.label || `atom-${++atomLabel}`
    }

    atomStates.set(atomRef, atom)
  }

  return atomStates.get(atomRef)
}

/**
 * Whenever we unsubscribe from a selector, we will
 * attempt to delete if it's no longer needed
 */
function dispose(atomStates, atomRef) {
  const atom = atomStates.get(atomRef)
  if (
    isSelector(atom) &&
    atom.listeners.size === 0 &&
    atom.children.size === 0
  ) {
    atomStates.delete(atomRef)
    for (const parentAtomRef of atom.parents) {
      const parentAtom = atomStates.get(parentAtomRef)
      parentAtom.children.delete(atomRef)
      dispose(atomStates, parentAtomRef)
    }
  }
}

function getSnapshot(atomStates, atomRef, arg) {
  const atom = init(atomStates, atomRef)

  if (!atom.selectorFn) {
    return atom.state
  }

  if (isDirty(atomStates, atomRef, arg)) {
    let [value, inputs] = evaluateSelectorFn(atomStates, atomRef, arg)
    if (atom.memo.has(arg) && atom.equal(atom.memo.get(arg).value, value)) {
      value = atom.memo.get(arg).value
    }
    atom.memo.set(arg, { value, inputs })
  }

  return atom.memo.get(arg).value
}

/**
 * Given a selector, check if we need to recompute
 * it's value, which is the case if:
 * - nothing is memoised yet
 * - inputs changed since the last time
 */
function isDirty(atomStates, atomRef, arg) {
  const atom = init(atomStates, atomRef)

  if (!atom.memo.has(arg)) {
    return true
  }

  const { inputs } = atom.memo.get(arg)

  for (const input of inputs) {
    const inputValue = getSnapshot(atomStates, input.atomRef, input.arg)
    if (inputValue !== input.value) {
      return true
    }
  }

  return false
}

/**
 * Notify listeners of atom's update
 */
function notify(atomStates, atomRef) {
  const atom = atomStates.get(atomRef)
  atom.listeners.forEach((l) => l())
  atom.children.forEach((childRef) => notify(atomStates, childRef))
}

/**
 * Listen to atom changes
 */
function subscribe(atomStates, atomRef, fn) {
  const atom = init(atomStates, atomRef)
  atom.listeners.add(fn)
  return function unsubscribe() {
    atom.listeners.delete(fn)
    dispose(atomStates, atomRef)
  }
}

/**
 * Hook to subscribe to atom/selector value
 */

export function useSelector(selectorFn, deps, equal, label) {
  const atomStates = useContext(AtomContext)

  const atomRef = useMemo(() => {
    return selector(
      isAtomOrSelector(selectorFn) ? () => selectorFn() : selectorFn,
      { equal, label },
    )
  }, deps)

  const { subscribe_, getSnapshot_ } = useMemo(() => {
    const subscribe_ = (cb) => subscribe(atomStates, atomRef, cb)
    const getSnapshot_ = () => getSnapshot(atomStates, atomRef)
    return { subscribe_, getSnapshot_ }
  }, [atomStates, atomRef])

  return useSyncExternalStore(subscribe_, getSnapshot_)
}

/**
 * Hook for updating atom using a reducer
 */
export function useReducer(atomRef, reducer) {
  const atomStates = useContext(AtomContext)

  return useCallback(
    function dispatch(action) {
      const atom = init(atomStates, atomRef)
      assert(!isSelector(atom), 'Only atoms can be updated')
      const curr = atom.state
      atom.state = reducer(atom.state, action)
      if (curr !== atom.state) {
        notify(atomStates, atomRef)
      }
    },
    [reducer],
  )
}

/**
 * Hook for updating atom using a setter
 */
export function useSetter(atomRef) {
  const set = useReducer(atomRef, (state, update) => {
    if (typeof update === 'function') {
      return update(state)
    } else {
      return update
    }
  })

  return set
}

function assert(invariant, message) {
  if (!invariant) {
    throw new Error(message)
  }
}

function isAtomOrSelector(atomRef) {
  return atomMetas.has(atomRef)
}

function isSelector(atom) {
  return has(atom, 'selectorFn')
}

function has(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key)
}
