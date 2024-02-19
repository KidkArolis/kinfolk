'use strict'
Object.defineProperty(exports, '__esModule', {
  value: true,
})
function _export(target, all) {
  for (var name in all)
    Object.defineProperty(target, name, {
      enumerable: true,
      get: all[name],
    })
}
_export(exports, {
  Provider: function () {
    return Provider
  },
  atom: function () {
    return atom
  },
  createContext: function () {
    return createContext
  },
  createStore: function () {
    return createStore
  },
  selector: function () {
    return selector
  },
  useReducer: function () {
    return useReducer
  },
  useSelector: function () {
    return useSelector
  },
  useSetter: function () {
    return useSetter
  },
})
const _react = /*#__PURE__*/ _interop_require_wildcard(require('react'))
function _getRequireWildcardCache(nodeInterop) {
  if (typeof WeakMap !== 'function') return null
  var cacheBabelInterop = new WeakMap()
  var cacheNodeInterop = new WeakMap()
  return (_getRequireWildcardCache = function (nodeInterop) {
    return nodeInterop ? cacheNodeInterop : cacheBabelInterop
  })(nodeInterop)
}
function _interop_require_wildcard(obj, nodeInterop) {
  if (!nodeInterop && obj && obj.__esModule) {
    return obj
  }
  if (obj === null || (typeof obj !== 'object' && typeof obj !== 'function')) {
    return {
      default: obj,
    }
  }
  var cache = _getRequireWildcardCache(nodeInterop)
  if (cache && cache.has(obj)) {
    return cache.get(obj)
  }
  var newObj = {
    __proto__: null,
  }
  var hasPropertyDescriptor =
    Object.defineProperty && Object.getOwnPropertyDescriptor
  for (var key in obj) {
    if (key !== 'default' && Object.prototype.hasOwnProperty.call(obj, key)) {
      var desc = hasPropertyDescriptor
        ? Object.getOwnPropertyDescriptor(obj, key)
        : null
      if (desc && (desc.get || desc.set)) {
        Object.defineProperty(newObj, key, desc)
      } else {
        newObj[key] = obj[key]
      }
    }
  }
  newObj.default = obj
  if (cache) {
    cache.set(obj, newObj)
  }
  return newObj
}
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

 */ /**
 * A map of atomRef -> atomMeta storing all atomMetas ever created.
 */ const atomMetas = new WeakMap()
/*
 * Indices for default atom and selector labeling
 */ let atomLabel = 0
let selectorLabel = 0
/**
 * Machinery to allow reading and subscribing to atoms
 * and selectors inside other selectors
 */ const defaultGet = () =>
  assert(false, 'Atoms can only be read in selectors')
const __getters = [defaultGet]
const __get = function () {
  for (
    var _len = arguments.length, args = new Array(_len), _key = 0;
    _key < _len;
    _key++
  ) {
    args[_key] = arguments[_key]
  }
  return __getters[__getters.length - 1](...args)
}
function withGetter(get, fn) {
  __getters.push(get)
  try {
    return fn()
  } finally {
    __getters.pop()
  }
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
    const parentAtom = getAtom(atomStates, parentAtomRef)
    atom.parents.add(parentAtomRef)
    parentAtom.children.add(atomRef)
    // compute the value and keep track of inputs
    const value = getSnapshot(atomStates, parentAtomRef, arg)
    inputs.push({
      atomRef: parentAtomRef,
      arg,
      value,
    })
    return value
  }
  const val = withGetter(get, () => atom.selectorFn(arg))
  return [val, inputs]
}
function createContext() {
  const KinfolkContext = /*#__PURE__*/ (0, _react.createContext)()
  const Provider = createProvider(KinfolkContext)
  const useSetter = createUseSetter(KinfolkContext)
  const useReducer = createUseReducer(KinfolkContext)
  const useSelector = createUseSelector(KinfolkContext)
  return {
    atom,
    selector,
    Provider,
    useSelector,
    useSetter,
    useReducer,
  }
}
const { Provider, useSelector, useSetter, useReducer } = createContext()
/**
 * Provider stores the state of the atoms to be shared
 * within the wrapped subtree.
 */ function createProvider(KinfolkContext) {
  return function Provider(param) {
    let { store, children } = param
    const [{ atomStates }] = (0, _react.useState)(() => store || createStore())
    return /*#__PURE__*/ _react.default.createElement(
      KinfolkContext.Provider,
      {
        value: atomStates,
      },
      children,
    )
  }
}
function atom(initialState) {
  let { label } =
    arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {}
  const atomRef = () => __get(atomRef)
  if (label) atomRef.label = label
  const atomMeta = {
    initialState,
  }
  atomMetas.set(atomRef, atomMeta)
  return atomRef
}
function selector(selectorFn) {
  let {
    label,
    equal,
    persist = true,
  } = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {}
  const selectorRef = (arg) => __get(selectorRef, arg)
  if (label) selectorRef.label = label
  const selectorMeta = {
    selectorFn,
    equal,
    persist,
  }
  atomMetas.set(selectorRef, selectorMeta)
  return selectorRef
}
function getAtom(atomStates, atomRef) {
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
      atom.equal = atomMeta.equal || shallowEqual
      atom.memo = new Map()
      atom.label = atom.label || `selector${++selectorLabel}`
      atom.persist = atomMeta.persist
    } else {
      atom.label = atom.label || `atom${++atomLabel}`
    }
    atomStates.set(atomRef, atom)
  }
  return atomStates.get(atomRef)
}
/**
 * Whenever we unsubscribe from a selector, we will
 * attempt to delete if it's no longer needed
 */ function dispose(atomStates, atomRef) {
  const atom = atomStates.get(atomRef)
  if (
    isSelector(atom) &&
    atom.listeners.size === 0 &&
    atom.children.size === 0
  ) {
    if (!atom.persist) {
      atomStates.delete(atomRef)
    }
    for (const parentAtomRef of atom.parents) {
      const parentAtom = atomStates.get(parentAtomRef)
      parentAtom.children.delete(atomRef)
      dispose(atomStates, parentAtomRef)
    }
  }
}
function getSnapshot(atomStates, atomRef, arg) {
  const atom = getAtom(atomStates, atomRef)
  if (!isSelector(atom)) {
    return atom.state
  }
  if (isDirty(atomStates, atomRef, arg)) {
    let [value, inputs] = evaluateSelectorFn(atomStates, atomRef, arg)
    if (atom.memo.has(arg) && atom.equal(atom.memo.get(arg).value, value)) {
      value = atom.memo.get(arg).value
    }
    atom.memo.set(arg, {
      value,
      inputs,
    })
  }
  return atom.memo.get(arg).value
}
/**
 * Given a selector, check if we need to recompute
 * it's value, which is the case if:
 * - nothing is memoised yet
 * - inputs changed since the last time
 */ function isDirty(atomStates, atomRef, arg) {
  const atom = getAtom(atomStates, atomRef)
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
 */ function notify(atomStates, atomRef) {
  const atom = atomStates.get(atomRef)
  atom.listeners.forEach((l) => l())
  atom.children.forEach((childRef) => notify(atomStates, childRef))
}
/**
 * Listen to atom changes
 */ function subscribe(atomStates, atomRef, fn) {
  const atom = getAtom(atomStates, atomRef)
  atom.listeners.add(fn)
  return function unsubscribe() {
    atom.listeners.delete(fn)
    dispose(atomStates, atomRef)
  }
}
/**
 * Hook to subscribe to atom/selector value
 */ function createUseSelector(KinfolkContext) {
  return function useSelector(selectorFnOrRef, deps) {
    let options =
      arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {}
    const atomStates = (0, _react.useContext)(KinfolkContext)
    // in case someone passed in an atomRef or selectorRef
    // we wrap it into a selector function that reads the value
    const selectorFn = isAtomOrSelectorRef(selectorFnOrRef)
      ? (0, _react.useCallback)(() => selectorFnOrRef(), [selectorFnOrRef])
      : (0, _react.useCallback)(selectorFnOrRef, deps)
    // notice, we don't re-look at the options after memoising the selectorFn
    // if the users really want to update equal or label, they should pass
    // that into the dependencies
    const atomRef = (0, _react.useMemo)(
      () =>
        selector(selectorFn, {
          ...options,
          persist: false,
        }), // eslint-disable-next-line react-hooks/exhaustive-deps
      [selectorFn],
    )
    const { subscribe_, getSnapshot_ } = (0, _react.useMemo)(
      () => ({
        subscribe_: (cb) => subscribe(atomStates, atomRef, cb),
        getSnapshot_: () => getSnapshot(atomStates, atomRef),
      }),
      [atomStates, atomRef],
    )
    return (0, _react.useSyncExternalStore)(subscribe_, getSnapshot_)
  }
}
/**
 * Update the state of the atom
 * notifying all dependends in the process
 */ function update(atomStates, atomRef, updater) {
  const atom = getAtom(atomStates, atomRef)
  assert(!isSelector(atom), 'Only atoms can be updated')
  const curr = atom.state
  atom.state = updater(atom.state)
  if (curr !== atom.state) {
    notify(atomStates, atomRef)
  }
}
/**
 * Hook for updating atom using a reducer
 */ function createUseReducer(KinfolkContext) {
  return function useReducer(atomRef, reducer) {
    const atomStates = (0, _react.useContext)(KinfolkContext)
    return (0, _react.useCallback)(
      function dispatch(action) {
        update(atomStates, atomRef, (state) => reducer(state, action))
      },
      [atomStates, atomRef, reducer],
    )
  }
}
/**
 * Hook for updating atom using a setter
 */ function createUseSetter(KinfolkContext) {
  const useReducer = createUseReducer(KinfolkContext)
  return function useSetter(atomRef) {
    return useReducer(atomRef, setReducer)
  }
}
/**
 * The reducer used inside useSetter
 * hoisted out of that hook for perf
 */ function setReducer(state, update) {
  return typeof update === 'function' ? update(state) : update
}
function createStore() {
  const store = {
    // for debugging, not a public API
    atomMetas,
    // for debugging, not a public API
    atomStates: new Map(),
    // get a value of an atom
    get(atomRef, arg) {
      const { atomStates } = store
      return getSnapshot(atomStates, atomRef, arg)
    },
    // update the value of an atom
    set(atomRef, value) {
      const { atomStates } = store
      update(atomStates, atomRef, (state) =>
        typeof value === 'function' ? value(state) : value,
      )
    },
    // read out all of values in the entire app
    // keyed by the atom label (generated or provided)
    // and also include all of the current selector
    // state in the __selectors key
    debug() {
      const { atomStates } = store
      const result = {
        __selectors: {},
      }
      for (const atomState of atomStates.values()) {
        const { label, selectorFn, state, memo } = atomState
        const dest = selectorFn ? result.__selectors : result
        const val = selectorFn ? memo : state
        if (dest[label]) {
          if (!Array.isArray(dest[label])) {
            dest[label] = [dest[label]]
          }
          dest[label].push(val)
        } else {
          dest[label] = val
        }
      }
      return result
    },
  }
  return store
}
/**
 * Slightly fancy shallow equality comparator that checks for
 *  - object equality
 *  - shallow object equality by matching all keys
 *  - shallow array equality by matching all items
 *
 * this will catch some cases where values computed in selectors
 * will get memoised more easily in cases they return shallowly
 * equal objects or arrays
 */ function shallowEqual(a, b) {
  return Object.is(a, b) || objEqual(a, b) || arrEqual(a, b)
}
function objEqual(a, b) {
  if (a === b) return true
  if (!a || !b) return false
  if (!isObject(a) || !isObject(b)) return false
  for (const k in a) if (a[k] !== b[k]) return false
  for (const k in b) if (!(k in a)) return false
  return true
}
function arrEqual(a, b) {
  if (a === b) return true
  if (!a || !b) return false
  if (!Array.isArray(a) || !Array.isArray(b)) return false
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}
function isObject(obj) {
  return (
    typeof obj === 'object' &&
    Object.prototype.toString.call(obj) === '[object Object]'
  )
}
function assert(invariant, message) {
  if (!invariant) {
    throw new Error(message)
  }
}
function isAtomOrSelectorRef(atomRef) {
  return atomMetas.has(atomRef)
}
function isSelector(atom) {
  return has(atom, 'selectorFn')
}
function has(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key)
}
