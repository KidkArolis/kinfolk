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

  atom() -> atomRef
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
 * Machinery to allow reading and subscribing to atoms
 * and selectors inside other selectors
 */
const defaultGet = () => {
  throw new Error('Atom values can only be read inside selectors')
}
const __getters = [defaultGet]
const __get = (...args) => __getters[__getters.length - 1](...args)
function withGetter(get, fn) {
  __getters.push(get)
  const val = fn()
  __getters.pop()
  return val
}

let atomLabel = 0
let selectorLabel = 0

/**
 * Provider stores the state of the atoms to be shared
 * within the wrapped subtree.
 */
export function Provider({ children, getAtomStates }) {
  const [atomStates] = useState(() => new Map())

  useEffect(() => {
    getAtomStates && getAtomStates(atomStates)
  }, [atomStates, getAtomStates])

  return <AtomContext.Provider value={atomStates}>{children}</AtomContext.Provider>
}

export function atom(initialState, { label } = {}) {
  const atomRef = () => __get(atomRef)
  if (label) atomRef.label = label
  const atomMeta = { initialState }
  atomMetas.set(atomRef, atomMeta)
  return atomRef
}

export function selector(selector, { label, equal } = {}) {
  const selectorRef = (arg) => __get(selectorRef, arg)
  if (label) selectorRef.label = label
  const selectorMeta = { selector, equal }
  atomMetas.set(selectorRef, selectorMeta)
  return selectorRef
}

function init(atomStates, atomRef) {
  if (!atomStates.has(atomRef)) {
    const atomMeta = atomMetas.get(atomRef)

    const atom = {
      state: null,
      listeners: new Set(),
      parents: [],
      children: [],
      label: atomRef.label,
    }

    if (has(atomMeta, 'initialState')) {
      atom.state = atomMeta.initialState
    }

    if (has(atomMeta, 'selector')) {
      atom.selector = atomMeta.selector
      atom.equal = atomMeta.equal || Object.is
      atom.memo = new Map()
      atom.dirty = new Map()
      atom.label = atom.label || `selector-${++selectorLabel}`
    } else {
      atom.label = atom.label || `atom-${++atomLabel}`
    }

    atomStates.set(atomRef, atom)
  }

  return atomStates.get(atomRef)
}

function vacuum(atomStates, atomRef) {
  const atom = atomStates.get(atomRef)
  if (isSelector(atom) && atom.listeners.size === 0 && atom.children.length === 0) {
    for (const parentAtomRef of atom.parents) {
      const parentAtom = atomStates.get(parentAtomRef)
      parentAtom.children = parentAtom.children.filter((child) => {
        if (child.atomRef !== atomRef) {
          return true
        } else {
          child.count -= 1
          return child.count > 0
        }
      })
    }
    atomStates.delete(atomRef)
  }
  // TODO - do we need to recursively walk up to
  // find parents that need to be cleared?
}

// TODO - remove
// function unmount(atomStates, atomRef) {
//   const atom = atomStates.get(atomRef)

//   if (atom && !atom.dependents.length) {
//     const dependencies = atom.dependencies

//     // invoke getter to clear dependencies
//     getter(atomStates, atomRef)

//     // delete atom since nobody is using it anymore
//     atomStates.delete(atomRef)

//     // and walk the dependency tree down to
//     // clean them up also
//     dependencies.forEach((depRef) => {
//       unmount(atomStates, depRef)
//     })
//   }
// }

function getSnapshot(atomStates, atomRef, arg) {
  const atom = init(atomStates, atomRef)

  if (!atom.selector) {
    return atom.state
  }

  const isDirty = !atom.dirty.has(arg) || atom.dirty.get(arg)
  // TODO - mark as non dirty if deps are not dirty (once they've been recomputed)
  // is that possible?! we don't know if we need count()
  //
  // inline <- count <- atom
  if (isDirty) {
    untrack(atomStates, atomRef)
    const get = getter(atomStates, atomRef)
    const val = withGetter(get, () => atom.selector(arg))
    if (!atom.memo.has(arg) || !atom.equal(atom.memo.get(arg), val)) {
      atom.memo.set(arg, val)
    }
    atom.dirty.set(arg, false)
  }

  return atom.memo.get(arg)
}

// when recomputing the selector for this atom
// we need to remove parent/children items since the new
// selector might depend on a different set of atoms
function untrack(atomStates, atomRef) {
  const atom = atomStates.get(atomRef)

  for (const parentAtomRef of atom.parents) {
    const parentAtom = atomStates.get(parentAtomRef)
    parentAtom.children = parentAtom.children.filter((child) => {
      if (child.atomRef !== atomRef) {
        return true
      } else {
        child.count -= 1
        return child.count > 0
      }
    })
  }

  atom.parents = []
}

/**
 * Getter reads atom's value, while also tracking
 * dependencies on any parent atoms
 */
function getter(atomStates, atomRef) {
  return (parentAtomRef, arg) => {
    const atom = atomStates.get(atomRef)
    const parentAtom = init(atomStates, parentAtomRef)

    // track dependencies
    if (!atom.parents.includes(parentAtomRef)) {
      atom.parents.push(parentAtomRef)
    }

    // and in reverse direction
    const children = parentAtom.children
    const existingChild = children.find((d) => d.atomRef === atomRef)
    if (existingChild) {
      // TODO is the count biz correct? we might call getSnapshot many times, etc.
      // we should think of sub/unsub when considering dependencies
      // in other words, deps are _computed_ during getSnapshot (and updated each time)
      // but only _enacted_ during subscribe/unsubscribe
      existingChild.count += 1
    } else {
      parentAtom.children.push({ count: 1, atomRef })
    }

    return getSnapshot(atomStates, parentAtomRef, arg)
  }
}

/**
 * Notify listeners of atom's update
 */
function notify(atomStates, atomRef) {
  dirty(atomStates, atomRef)
  // TODO recompute(atomStates, atomRef) ??
  // but do so only if there are listeners?
  // or tbh always, selectors don't exist if
  // there aren't listeners :thinking:
  // just need to handle families also...
  // and trigger only if changed?
  trigger(atomStates, atomRef)
}

/**
 * Mark all the cached values as dirty
 */
function dirty(atomStates, atomRef) {
  const atom = atomStates.get(atomRef)
  // TODO We shouldn't blow away the entire cache
  // we could mark all as dirty
  // and when getting snapshot.. if deps _are not dirty_
  // we can mark ourselves as non dirty again
  if (isSelector(atom)) atom.dirty = new Map()
  atom.children.forEach((d) => dirty(atomStates, d.atomRef))
}

/**
 * Call the listeners
 */
function trigger(atomStates, atomRef) {
  const atom = atomStates.get(atomRef)
  atom.listeners.forEach((l) => l(atom.state))
  atom.children.forEach((d) => trigger(atomStates, d.atomRef))
}

/**
 * Listen to atom changes
 */
function subscribe(atomStates, atomRef, fn) {
  const atom = atomStates.get(atomRef)
  atom.listeners.add(fn)
  return function unsubscribe() {
    atom.listeners.delete(fn)
    vacuum(atomStates, atomRef)
  }
}

/**
 * Hook to subscribe to atom/selector value
 */

export function useSelector(selectorFn, deps, equal) {
  const atomStates = useContext(AtomContext)

  const atomRef = useMemo(() => {
    return selector(selectorFn, { equal })
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

      if (isSelector(atom)) {
        throw new Error('Selectors can not be updated directly, update an atom instead')
      }

      const curr = atom.state
      atom.state = reducer(atom.state, action)
      if (curr !== atom.state) {
        notify(atomStates, atomRef)
      }
    },
    [reducer]
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

function isSelector(atom) {
  return has(atom, 'selector')
}

function has(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key)
}
