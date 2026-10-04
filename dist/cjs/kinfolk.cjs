var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var stdin_exports = {};
__export(stdin_exports, {
  Provider: () => Provider,
  atom: () => atom,
  createContext: () => createContext,
  createStore: () => createStore,
  selector: () => selector,
  useReducer: () => useReducer,
  useSelector: () => useSelector,
  useSetter: () => useSetter
});
module.exports = __toCommonJS(stdin_exports);
var import_react = __toESM(require("react"));
const atomMetas = /* @__PURE__ */ new WeakMap();
let atomLabel = 0;
let selectorLabel = 0;
const defaultGet = () => assert(false, "Atoms can only be read in selectors");
const __getters = [defaultGet];
const __get = (...args) => __getters[__getters.length - 1](...args);
function withGetter(get, fn) {
  __getters.push(get);
  try {
    return fn();
  } finally {
    __getters.pop();
  }
}
function evaluateSelectorFn(atomStates, atomRef, arg) {
  const atom2 = atomStates.get(atomRef);
  for (const parentAtomRef of atom2.parents) {
    const parentAtom = atomStates.get(parentAtomRef);
    parentAtom.children.delete(atomRef);
  }
  atom2.parents.clear();
  const inputs = [];
  const get = (parentAtomRef, arg2) => {
    const parentAtom = getAtom(atomStates, parentAtomRef);
    atom2.parents.add(parentAtomRef);
    parentAtom.children.add(atomRef);
    const value = getSnapshot(atomStates, parentAtomRef, arg2);
    inputs.push({ atomRef: parentAtomRef, arg: arg2, value });
    return value;
  };
  const val = withGetter(get, () => atom2.selectorFn(arg));
  return [val, inputs];
}
function createContext() {
  const KinfolkContext = (0, import_react.createContext)();
  const Provider2 = createProvider(KinfolkContext);
  const useSetter2 = createUseSetter(KinfolkContext);
  const useReducer2 = createUseReducer(KinfolkContext);
  const useSelector2 = createUseSelector(KinfolkContext);
  return { atom, selector, Provider: Provider2, useSelector: useSelector2, useSetter: useSetter2, useReducer: useReducer2 };
}
const { Provider, useSelector, useSetter, useReducer } = createContext();
function createProvider(KinfolkContext) {
  return function Provider2({ store, children }) {
    const [{ atomStates }] = (0, import_react.useState)(() => store || createStore());
    return /* @__PURE__ */ import_react.default.createElement(KinfolkContext.Provider, { value: atomStates }, children);
  };
}
function atom(initialState, { label } = {}) {
  const atomRef = () => __get(atomRef);
  if (label) atomRef.label = label;
  const atomMeta = { initialState };
  atomMetas.set(atomRef, atomMeta);
  return atomRef;
}
function selector(selectorFn, { label, equal, persist = true } = {}) {
  const selectorRef = (arg) => __get(selectorRef, arg);
  if (label) selectorRef.label = label;
  const selectorMeta = { selectorFn, equal, persist };
  atomMetas.set(selectorRef, selectorMeta);
  return selectorRef;
}
function getAtom(atomStates, atomRef) {
  if (!atomStates.has(atomRef)) {
    const atomMeta = atomMetas.get(atomRef);
    const atom2 = {
      state: null,
      listeners: /* @__PURE__ */ new Set(),
      parents: /* @__PURE__ */ new Set(),
      children: /* @__PURE__ */ new Set(),
      label: atomRef.label
    };
    if (has(atomMeta, "initialState")) {
      atom2.state = atomMeta.initialState;
    }
    if (has(atomMeta, "selectorFn")) {
      atom2.selectorFn = atomMeta.selectorFn;
      atom2.equal = atomMeta.equal || shallowEqual;
      atom2.memo = /* @__PURE__ */ new Map();
      atom2.label = atom2.label || `selector${++selectorLabel}`;
      atom2.persist = atomMeta.persist;
    } else {
      atom2.label = atom2.label || `atom${++atomLabel}`;
    }
    atomStates.set(atomRef, atom2);
  }
  return atomStates.get(atomRef);
}
function dispose(atomStates, atomRef) {
  const atom2 = atomStates.get(atomRef);
  if (isSelector(atom2) && atom2.listeners.size === 0 && atom2.children.size === 0) {
    if (!atom2.persist) {
      atomStates.delete(atomRef);
    }
    for (const parentAtomRef of atom2.parents) {
      const parentAtom = atomStates.get(parentAtomRef);
      parentAtom.children.delete(atomRef);
      dispose(atomStates, parentAtomRef);
    }
  }
}
function getSnapshot(atomStates, atomRef, arg) {
  const atom2 = getAtom(atomStates, atomRef);
  if (!isSelector(atom2)) {
    return atom2.state;
  }
  if (isDirty(atomStates, atomRef, arg)) {
    let [value, inputs] = evaluateSelectorFn(atomStates, atomRef, arg);
    if (atom2.memo.has(arg) && atom2.equal(atom2.memo.get(arg).value, value)) {
      value = atom2.memo.get(arg).value;
    }
    atom2.memo.set(arg, { value, inputs });
  }
  return atom2.memo.get(arg).value;
}
function isDirty(atomStates, atomRef, arg) {
  const atom2 = getAtom(atomStates, atomRef);
  if (!atom2.memo.has(arg)) {
    return true;
  }
  const { inputs } = atom2.memo.get(arg);
  for (const input of inputs) {
    const inputValue = getSnapshot(atomStates, input.atomRef, input.arg);
    if (inputValue !== input.value) {
      return true;
    }
  }
  return false;
}
function notify(atomStates, atomRef) {
  const atom2 = atomStates.get(atomRef);
  atom2.listeners.forEach((l) => l());
  atom2.children.forEach((childRef) => notify(atomStates, childRef));
}
function subscribe(atomStates, atomRef, fn) {
  const atom2 = getAtom(atomStates, atomRef);
  atom2.listeners.add(fn);
  return function unsubscribe() {
    atom2.listeners.delete(fn);
    dispose(atomStates, atomRef);
  };
}
function createUseSelector(KinfolkContext) {
  return function useSelector2(selectorFnOrRef, deps, options = {}) {
    const atomStates = (0, import_react.useContext)(KinfolkContext);
    const selectorFn = isAtomOrSelectorRef(selectorFnOrRef) ? (
      // eslint-disable-next-line react-hooks/rules-of-hooks
      (0, import_react.useCallback)(() => selectorFnOrRef(), [selectorFnOrRef])
    ) : (
      // eslint-disable-next-line react-hooks/rules-of-hooks, react-hooks/exhaustive-deps
      (0, import_react.useCallback)(selectorFnOrRef, deps)
    );
    const atomRef = (0, import_react.useMemo)(
      () => selector(selectorFn, { ...options, persist: false }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [selectorFn]
    );
    const { subscribe_, getSnapshot_ } = (0, import_react.useMemo)(
      () => ({
        subscribe_: (cb) => subscribe(atomStates, atomRef, cb),
        getSnapshot_: () => getSnapshot(atomStates, atomRef)
      }),
      [atomStates, atomRef]
    );
    return (0, import_react.useSyncExternalStore)(subscribe_, getSnapshot_);
  };
}
function update(atomStates, atomRef, updater) {
  const atom2 = getAtom(atomStates, atomRef);
  assert(!isSelector(atom2), "Only atoms can be updated");
  const curr = atom2.state;
  atom2.state = updater(atom2.state);
  if (curr !== atom2.state) {
    notify(atomStates, atomRef);
  }
}
function createUseReducer(KinfolkContext) {
  return function useReducer2(atomRef, reducer) {
    const atomStates = (0, import_react.useContext)(KinfolkContext);
    return (0, import_react.useCallback)(
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
  const store = {
    // for debugging, not a public API
    atomMetas,
    // for debugging, not a public API
    atomStates: /* @__PURE__ */ new Map(),
    // get a value of an atom
    get(atomRef, arg) {
      const { atomStates } = store;
      return getSnapshot(atomStates, atomRef, arg);
    },
    // update the value of an atom
    set(atomRef, value) {
      const { atomStates } = store;
      update(
        atomStates,
        atomRef,
        (state) => typeof value === "function" ? value(state) : value
      );
    },
    // read out all of values in the entire app
    // keyed by the atom label (generated or provided)
    // and also include all of the current selector
    // state in the __selectors key
    debug() {
      const { atomStates } = store;
      const result = { __selectors: {} };
      for (const atomState of atomStates.values()) {
        const { label, selectorFn, state, memo } = atomState;
        const dest = selectorFn ? result.__selectors : result;
        const val = selectorFn ? memo : state;
        if (dest[label]) {
          if (!Array.isArray(dest[label])) {
            dest[label] = [dest[label]];
          }
          dest[label].push(val);
        } else {
          dest[label] = val;
        }
      }
      return result;
    }
  };
  return store;
}
function shallowEqual(a, b) {
  return Object.is(a, b) || objEqual(a, b) || arrEqual(a, b);
}
function objEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (!isObject(a) || !isObject(b)) return false;
  for (const k in a) if (a[k] !== b[k]) return false;
  for (const k in b) if (!(k in a)) return false;
  return true;
}
function arrEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
function isObject(obj) {
  return typeof obj === "object" && Object.prototype.toString.call(obj) === "[object Object]";
}
function assert(invariant, message) {
  if (!invariant) {
    throw new Error(message);
  }
}
function isAtomOrSelectorRef(atomRef) {
  return atomMetas.has(atomRef);
}
function isSelector(atom2) {
  return has(atom2, "selectorFn");
}
function has(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}
