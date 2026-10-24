var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import React, {
  createContext as createReactContext,
  useState,
  useContext,
  useCallback,
  useMemo,
  useSyncExternalStore
} from "react";
const atomType = /* @__PURE__ */ Symbol("atom");
const selectorType = /* @__PURE__ */ Symbol("selector");
class AtomStates extends Map {
  constructor() {
    super(...arguments);
    __publicField(this, "pending", /* @__PURE__ */ new WeakMap());
  }
}
const atomMetas = /* @__PURE__ */ new WeakMap();
let atomLabel = 0;
let selectorLabel = 0;
let currentGet = () => {
  throw new Error("Atoms can only be read in selectors");
};
function withGetter(get, fn) {
  const previousGet = currentGet;
  currentGet = get;
  try {
    return fn();
  } finally {
    currentGet = previousGet;
  }
}
function evaluateSelectorFn(atomStates, atom2, arg) {
  const inputs = [];
  const get = (parentAtomRef, arg2) => {
    const value2 = getSnapshot(atomStates, parentAtomRef, arg2);
    inputs.push({ atomRef: parentAtomRef, arg: arg2, value: value2 });
    return value2;
  };
  const value = withGetter(get, () => atom2.selectorFn(arg));
  return { value, inputs };
}
function createContext() {
  const KinfolkContext = createReactContext(void 0);
  return {
    atom,
    selector,
    Provider: createProvider(KinfolkContext),
    useSelector: createUseSelector(KinfolkContext),
    useSetter: createUseSetter(KinfolkContext),
    useReducer: createUseReducer(KinfolkContext)
  };
}
const { Provider, useSelector, useSetter, useReducer } = createContext();
function createProvider(KinfolkContext) {
  return function Provider2({ store, children }) {
    const [{ atomStates }] = useState(() => store || createStore());
    return /* @__PURE__ */ React.createElement(KinfolkContext.Provider, { value: atomStates }, children);
  };
}
function atom(initialState, { label } = {}) {
  const atomRef = Object.assign(() => currentGet(atomRef), {
    [atomType]: true
  });
  if (label) atomRef.label = label;
  atomMetas.set(atomRef, { kind: "atom", initialState });
  return atomRef;
}
function selector(selectorFn, { label, equal, persist = true } = {}) {
  const selectorRef = Object.assign(
    (arg) => currentGet(selectorRef, arg),
    { [selectorType]: true }
  );
  if (label) selectorRef.label = label;
  atomMetas.set(selectorRef, {
    kind: "selector",
    selectorFn: (arg) => selectorFn(arg),
    equal: equal ? (a, b) => equal(a, b) : shallowEqual,
    persist
  });
  return selectorRef;
}
function getAtom(atomStates, atomRef) {
  const existing = atomStates.get(atomRef) || atomStates.pending.get(atomRef);
  if (existing) return existing;
  const meta = atomMetas.get(atomRef);
  if (!meta) throw new Error("Expected a Kinfolk atom or selector");
  const common = {
    listeners: /* @__PURE__ */ new Set(),
    parents: /* @__PURE__ */ new Set(),
    children: /* @__PURE__ */ new Set(),
    label: atomRef.label || (meta.kind === "selector" ? `selector${++selectorLabel}` : `atom${++atomLabel}`)
  };
  const state = meta.kind === "atom" ? { ...common, kind: "atom", state: meta.initialState } : { ...common, ...meta, memo: /* @__PURE__ */ new Map() };
  if (state.kind === "selector" && !state.persist)
    atomStates.pending.set(atomRef, state);
  else atomStates.set(atomRef, state);
  return state;
}
function dispose(atomStates, atomRef) {
  const atom2 = getAtom(atomStates, atomRef);
  if (atom2.kind === "selector" && atom2.listeners.size === 0 && atom2.children.size === 0) {
    if (!atom2.persist) {
      atomStates.delete(atomRef);
      atomStates.pending.delete(atomRef);
    }
    for (const parentAtomRef of atom2.parents) {
      getAtom(atomStates, parentAtomRef).children.delete(atomRef);
      dispose(atomStates, parentAtomRef);
    }
  }
}
function getSnapshot(atomStates, atomRef, arg) {
  const atom2 = getAtom(atomStates, atomRef);
  if (atom2.kind === "atom") return atom2.state;
  const memo = atom2.memo.get(arg);
  if (memo && !isDirty(atomStates, memo.inputs)) {
    connectParents(atomStates, atomRef, atom2);
    return memo.value;
  }
  const next = evaluateSelectorFn(atomStates, atom2, arg);
  if (memo && atom2.equal(memo.value, next.value)) next.value = memo.value;
  atom2.memo.set(arg, next);
  connectParents(atomStates, atomRef, atom2);
  return next.value;
}
function connectParents(atomStates, atomRef, atom2) {
  const parents = /* @__PURE__ */ new Set();
  for (const { inputs } of atom2.memo.values()) {
    for (const { atomRef: parentRef } of inputs) parents.add(parentRef);
  }
  for (const parentRef of atom2.parents) {
    if (!parents.has(parentRef)) {
      getAtom(atomStates, parentRef).children.delete(atomRef);
      dispose(atomStates, parentRef);
    }
  }
  atom2.parents = parents;
  if (atom2.listeners.size > 0 || atom2.children.size > 0) {
    atomStates.set(atomRef, atom2);
    for (const parentRef of parents) {
      const parent = getAtom(atomStates, parentRef);
      parent.children.add(atomRef);
      if (parent.kind === "selector")
        connectParents(atomStates, parentRef, parent);
    }
  }
}
function isDirty(atomStates, inputs) {
  return inputs.some(
    (input) => !Object.is(
      getSnapshot(atomStates, input.atomRef, input.arg),
      input.value
    )
  );
}
function notify(atomStates, atomRef) {
  const atom2 = getAtom(atomStates, atomRef);
  atom2.listeners.forEach((listener) => listener());
  for (const childRef of [...atom2.children]) notify(atomStates, childRef);
}
function subscribe(atomStates, atomRef, fn) {
  const atom2 = getAtom(atomStates, atomRef);
  atom2.listeners.add(fn);
  getSnapshot(atomStates, atomRef);
  return function unsubscribe() {
    atom2.listeners.delete(fn);
    dispose(atomStates, atomRef);
  };
}
function useAtomStates(context) {
  const states = useContext(context);
  if (!states)
    throw new Error("Kinfolk hooks must be used within their Provider");
  return states;
}
function createUseSelector(KinfolkContext) {
  return function useSelector2(selectorFnOrRef, deps, options = {}) {
    const atomStates = useAtomStates(KinfolkContext);
    const isRef = atomMetas.has(selectorFnOrRef);
    const selectorFn = useMemo(
      () => selectorFnOrRef,
      // References track identity. Without dependencies, callbacks refresh every render.
      // oxlint-disable-next-line react-hooks/exhaustive-deps
      isRef ? [selectorFnOrRef] : deps ?? [{}]
    );
    const atomRef = useMemo(
      () => selector(selectorFn, { ...options, persist: false }),
      // Options are captured until the selector's dependencies change.
      // oxlint-disable-next-line react-hooks/exhaustive-deps
      [selectorFn]
    );
    const { subscribe_, getSnapshot_ } = useMemo(
      () => ({
        subscribe_: (cb) => subscribe(atomStates, atomRef, cb),
        getSnapshot_: () => getSnapshot(atomStates, atomRef)
      }),
      [atomStates, atomRef]
    );
    return useSyncExternalStore(subscribe_, getSnapshot_);
  };
}
function update(atomStates, atomRef, updater) {
  const atom2 = getAtom(atomStates, atomRef);
  if (atom2.kind === "selector") throw new Error("Only atoms can be updated");
  const curr = atom2.state;
  atom2.state = updater(atom2.state);
  if (!Object.is(curr, atom2.state)) notify(atomStates, atomRef);
}
function createUseReducer(KinfolkContext) {
  return function useReducer2(atomRef, reducer) {
    const atomStates = useAtomStates(KinfolkContext);
    return useCallback(
      function dispatch(action) {
        update(atomStates, atomRef, (state) => reducer(state, action));
      },
      [atomStates, atomRef, reducer]
    );
  };
}
function createUseSetter(KinfolkContext) {
  const useReducer2 = createUseReducer(KinfolkContext);
  return function useSetter2(atomRef) {
    return useReducer2(atomRef, setReducer);
  };
}
function setReducer(state, update2) {
  return typeof update2 === "function" ? update2(state) : update2;
}
function createStore() {
  const atomStates = new AtomStates();
  return {
    atomMetas,
    atomStates,
    get(atomRef, arg) {
      return getSnapshot(atomStates, atomRef, arg);
    },
    set(atomRef, value) {
      update(atomStates, atomRef, (state) => setReducer(state, value));
    },
    debug() {
      const result = { __selectors: {} };
      const groups = /* @__PURE__ */ new Map();
      for (const atomState of atomStates.values()) {
        const { label } = atomState;
        const dest = atomState.kind === "selector" ? result.__selectors : result;
        const val = atomState.kind === "selector" ? atomState.memo : atomState.state;
        let labels = groups.get(dest);
        if (!labels) {
          labels = /* @__PURE__ */ new Map();
          groups.set(dest, labels);
        }
        const group = labels.get(label);
        if (group) {
          group.push(val);
          dest[label] = group;
        } else {
          labels.set(label, [val]);
          dest[label] = val;
        }
      }
      return result;
    }
  };
}
function shallowEqual(a, b) {
  return Object.is(a, b) || objEqual(a, b) || arrEqual(a, b);
}
function objEqual(a, b) {
  if (!isObject(a) || !isObject(b)) return false;
  const keys = enumerableKeys(a);
  if (keys.length !== enumerableKeys(b).length) return false;
  return keys.every(
    (key) => Object.prototype.propertyIsEnumerable.call(b, key) && Object.is(a[key], b[key])
  );
}
function enumerableKeys(value) {
  return Reflect.ownKeys(value).filter(
    (key) => Object.prototype.propertyIsEnumerable.call(value, key)
  );
}
function arrEqual(a, b) {
  if (!a || !b) return false;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
  return true;
}
function isObject(obj) {
  return typeof obj === "object" && Object.prototype.toString.call(obj) === "[object Object]";
}
export {
  Provider,
  atom,
  createContext,
  createStore,
  selector,
  useReducer,
  useSelector,
  useSetter
};
