import React, {
  createContext as createReactContext,
  useState,
  useContext,
  useCallback,
  useMemo,
  useSyncExternalStore,
  type Context,
  type DependencyList,
  type ReactNode,
} from 'react'

const atomType = Symbol('atom')
const selectorType = Symbol('selector')

export interface Atom<T> {
  (): T
  label?: string
  readonly [atomType]: true
}

export interface Selector<T, A = void> {
  (arg: A): T
  label?: string
  readonly [selectorType]: true
}

export type Update<T> = T | ((state: T) => T)
export interface AtomOptions {
  label?: string
}
export interface SelectorOptions<T> extends AtomOptions {
  equal?: (previous: T, next: T) => boolean
  persist?: boolean
}
export type UseSelectorOptions<T> = Omit<SelectorOptions<T>, 'persist'>
export interface ProviderProps {
  store?: Store
  children?: ReactNode
}

// Each store contains differently typed references. Values are erased only here,
// and restored at the public boundary associated with the same reference.
type Ref = { label?: string }
type AtomMeta = { kind: 'atom'; initialState: unknown }
type SelectorMeta = {
  kind: 'selector'
  selectorFn: (arg: unknown) => unknown
  equal: (previous: unknown, next: unknown) => boolean
  persist: boolean
}
type Meta = AtomMeta | SelectorMeta
type Input = { atomRef: Ref; arg: unknown; value: unknown }
type Memo = { value: unknown; inputs: Input[] }
type CommonState = {
  listeners: Set<() => void>
  parents: Set<Ref>
  children: Set<Ref>
  label: string
}
type AtomState = CommonState & { kind: 'atom'; state: unknown }
type SelectorState = CommonState & SelectorMeta & { memo: Map<unknown, Memo> }
type State = AtomState | SelectorState
type AtomStates = Map<Ref, State>
type KinfolkContext = Context<AtomStates | undefined>
type Getter = (ref: Ref, arg?: unknown) => unknown

export interface Store {
  /** Internal maps exposed for debugging, not a stable public API. */
  atomMetas: WeakMap<object, Meta>
  atomStates: AtomStates
  get<T>(ref: Atom<T> | Selector<T>): T
  get<T, A>(ref: Selector<T, A>, arg: A): T
  set<T>(ref: Atom<T>, value: Update<T>): void
  debug(): Record<string, unknown> & { __selectors: Record<string, unknown> }
}

const atomMetas = new WeakMap<object, Meta>()
let atomLabel = 0
let selectorLabel = 0
let currentGet: Getter = () => {
  throw new Error('Atoms can only be read in selectors')
}

function withGetter<T>(get: Getter, fn: () => T): T {
  const previousGet = currentGet
  currentGet = get
  try {
    return fn()
  } finally {
    currentGet = previousGet
  }
}

function evaluateSelectorFn(
  atomStates: AtomStates,
  atomRef: Ref,
  atom: SelectorState,
  arg: unknown,
): Memo {
  for (const parentAtomRef of atom.parents) {
    getAtom(atomStates, parentAtomRef).children.delete(atomRef)
  }
  atom.parents.clear()

  const inputs: Input[] = []
  const get: Getter = (parentAtomRef, arg) => {
    atom.parents.add(parentAtomRef)
    const value = getSnapshot(atomStates, parentAtomRef, arg)
    inputs.push({ atomRef: parentAtomRef, arg, value })
    return value
  }
  const value = withGetter(get, () => atom.selectorFn(arg))
  return { value, inputs }
}

export function createContext() {
  const KinfolkContext = createReactContext<AtomStates | undefined>(undefined)
  return {
    atom,
    selector,
    Provider: createProvider(KinfolkContext),
    useSelector: createUseSelector(KinfolkContext),
    useSetter: createUseSetter(KinfolkContext),
    useReducer: createUseReducer(KinfolkContext),
  }
}

export const { Provider, useSelector, useSetter, useReducer } = createContext()

function createProvider(KinfolkContext: KinfolkContext) {
  return function Provider({ store, children }: ProviderProps) {
    const [{ atomStates }] = useState(() => store || createStore())
    return (
      <KinfolkContext.Provider value={atomStates}>
        {children}
      </KinfolkContext.Provider>
    )
  }
}

export function atom<T>(initialState: T, { label }: AtomOptions = {}): Atom<T> {
  const atomRef: Atom<T> = Object.assign(() => currentGet(atomRef) as T, {
    [atomType]: true as const,
  })
  if (label) atomRef.label = label
  atomMetas.set(atomRef, { kind: 'atom', initialState })
  return atomRef
}

export function selector<T, A = void>(
  selectorFn: (arg: A) => T,
  { label, equal, persist = true }: SelectorOptions<T> = {},
): Selector<T, A> {
  const selectorRef: Selector<T, A> = Object.assign(
    (arg: A) => currentGet(selectorRef, arg) as T,
    { [selectorType]: true as const },
  )
  if (label) selectorRef.label = label
  atomMetas.set(selectorRef, {
    kind: 'selector',
    selectorFn: (arg) => selectorFn(arg as A),
    equal: equal ? (a, b) => equal(a as T, b as T) : shallowEqual,
    persist,
  })
  return selectorRef
}

function getAtom(atomStates: AtomStates, atomRef: Ref): State {
  const existing = atomStates.get(atomRef)
  if (existing) return existing
  const meta = atomMetas.get(atomRef)
  if (!meta) throw new Error('Expected a Kinfolk atom or selector')
  const common: CommonState = {
    listeners: new Set(),
    parents: new Set(),
    children: new Set(),
    label:
      atomRef.label ||
      (meta.kind === 'selector'
        ? `selector${++selectorLabel}`
        : `atom${++atomLabel}`),
  }
  const state: State =
    meta.kind === 'atom'
      ? { ...common, kind: 'atom', state: meta.initialState }
      : { ...common, ...meta, memo: new Map() }
  atomStates.set(atomRef, state)
  return state
}

function dispose(atomStates: AtomStates, atomRef: Ref) {
  const atom = getAtom(atomStates, atomRef)
  if (
    atom.kind === 'selector' &&
    atom.listeners.size === 0 &&
    atom.children.size === 0
  ) {
    if (!atom.persist) atomStates.delete(atomRef)
    for (const parentAtomRef of atom.parents) {
      getAtom(atomStates, parentAtomRef).children.delete(atomRef)
      dispose(atomStates, parentAtomRef)
    }
  }
}

function getSnapshot(
  atomStates: AtomStates,
  atomRef: Ref,
  arg?: unknown,
): unknown {
  const atom = getAtom(atomStates, atomRef)
  if (atom.kind === 'atom') return atom.state
  const memo = atom.memo.get(arg)
  if (memo && !isDirty(atomStates, memo.inputs)) {
    connectParents(atomStates, atomRef, atom)
    return memo.value
  }
  const next = evaluateSelectorFn(atomStates, atomRef, atom, arg)
  if (memo && atom.equal(memo.value, next.value)) next.value = memo.value
  atom.memo.set(arg, next)
  connectParents(atomStates, atomRef, atom)
  return next.value
}

// Track every cached argument, but only attach notification edges for active selectors.
// Discarded React renders must not keep dependencies alive.
function connectParents(
  atomStates: AtomStates,
  atomRef: Ref,
  atom: SelectorState,
) {
  const active = atom.listeners.size > 0 || atom.children.size > 0
  for (const parentRef of atom.parents)
    getAtom(atomStates, parentRef).children.delete(atomRef)
  atom.parents.clear()
  for (const { inputs } of atom.memo.values()) {
    for (const { atomRef: parentRef } of inputs) {
      atom.parents.add(parentRef)
      if (active) {
        const parent = getAtom(atomStates, parentRef)
        parent.children.add(atomRef)
        if (parent.kind === 'selector')
          connectParents(atomStates, parentRef, parent)
      }
    }
  }
}

function isDirty(atomStates: AtomStates, inputs: Input[]) {
  return inputs.some(
    (input) =>
      !Object.is(
        getSnapshot(atomStates, input.atomRef, input.arg),
        input.value,
      ),
  )
}

function notify(atomStates: AtomStates, atomRef: Ref) {
  const atom = getAtom(atomStates, atomRef)
  atom.listeners.forEach((listener) => listener())
  // Snapshot the edges because listener reads may reconnect children during notification.
  // oxlint-disable-next-line unicorn/no-useless-spread
  for (const childRef of [...atom.children]) notify(atomStates, childRef)
}

function subscribe(atomStates: AtomStates, atomRef: Ref, fn: () => void) {
  const atom = getAtom(atomStates, atomRef)
  atom.listeners.add(fn)
  getSnapshot(atomStates, atomRef)
  return function unsubscribe() {
    atom.listeners.delete(fn)
    dispose(atomStates, atomRef)
  }
}

function useAtomStates(context: KinfolkContext): AtomStates {
  const states = useContext(context)
  if (!states)
    throw new Error('Kinfolk hooks must be used within their Provider')
  return states
}

function createUseSelector(KinfolkContext: KinfolkContext) {
  return function useSelector<T>(
    selectorFnOrRef: () => T,
    deps?: DependencyList,
    options: UseSelectorOptions<T> = {},
  ): T {
    const atomStates = useAtomStates(KinfolkContext)
    const isRef = atomMetas.has(selectorFnOrRef)
    const selectorFn = useMemo(
      () => selectorFnOrRef,
      // References track identity. Without dependencies, callbacks refresh every render.
      // oxlint-disable-next-line react-hooks/exhaustive-deps
      isRef ? [selectorFnOrRef] : (deps ?? [{}]),
    )
    const atomRef = useMemo(
      () => selector(selectorFn, { ...options, persist: false }),
      // Options are captured until the selector's dependencies change.
      // oxlint-disable-next-line react-hooks/exhaustive-deps
      [selectorFn],
    )
    const { subscribe_, getSnapshot_ } = useMemo(
      () => ({
        subscribe_: (cb: () => void) => subscribe(atomStates, atomRef, cb),
        getSnapshot_: () => getSnapshot(atomStates, atomRef) as T,
      }),
      [atomStates, atomRef],
    )
    return useSyncExternalStore(subscribe_, getSnapshot_)
  }
}

function update(
  atomStates: AtomStates,
  atomRef: Ref,
  updater: (state: unknown) => unknown,
) {
  const atom = getAtom(atomStates, atomRef)
  if (atom.kind === 'selector') throw new Error('Only atoms can be updated')
  const curr = atom.state
  atom.state = updater(atom.state)
  if (!Object.is(curr, atom.state)) notify(atomStates, atomRef)
}

function createUseReducer(KinfolkContext: KinfolkContext) {
  return function useReducer<T, A = void>(
    atomRef: Atom<T>,
    reducer: (state: T, action: A) => T,
  ) {
    const atomStates = useAtomStates(KinfolkContext)
    return useCallback(
      function dispatch(action: A) {
        update(atomStates, atomRef, (state) => reducer(state as T, action))
      },
      [atomStates, atomRef, reducer],
    )
  }
}

function createUseSetter(KinfolkContext: KinfolkContext) {
  const useReducer = createUseReducer(KinfolkContext)
  return function useSetter<T>(atomRef: Atom<T>) {
    return useReducer(atomRef, setReducer<T>)
  }
}

function setReducer<T>(state: T, update: Update<T>): T {
  // Function values use the same updater convention as React's state setters.
  return typeof update === 'function'
    ? (update as (state: T) => T)(state)
    : update
}

export function createStore(): Store {
  const atomStates: AtomStates = new Map()
  return {
    atomMetas,
    atomStates,
    get<T>(atomRef: Ref, arg?: unknown): T {
      return getSnapshot(atomStates, atomRef, arg) as T
    },
    set<T>(atomRef: Atom<T>, value: Update<T>) {
      update(atomStates, atomRef, (state) => setReducer(state as T, value))
    },
    debug() {
      const result: Record<string, unknown> & {
        __selectors: Record<string, unknown>
      } = { __selectors: {} }
      const groups = new Map<object, Map<string, unknown[]>>()
      for (const atomState of atomStates.values()) {
        const { label } = atomState
        const dest = atomState.kind === 'selector' ? result.__selectors : result
        const val =
          atomState.kind === 'selector' ? atomState.memo : atomState.state
        let labels = groups.get(dest)
        if (!labels) {
          labels = new Map()
          groups.set(dest, labels)
        }
        const group = labels.get(label)
        if (group) {
          group.push(val)
          dest[label] = group
        } else {
          labels.set(label, [val])
          dest[label] = val
        }
      }
      return result
    },
  }
}

function shallowEqual(a: unknown, b: unknown) {
  return Object.is(a, b) || objEqual(a, b) || arrEqual(a, b)
}

function objEqual(a: unknown, b: unknown) {
  if (!a || !b) return false
  if (!isObject(a) || !isObject(b)) return false
  for (const k in a) if (!Object.is(a[k], b[k])) return false
  for (const k in b) if (!(k in a)) return false
  return true
}

function arrEqual(a: unknown, b: unknown) {
  if (!a || !b) return false
  if (!Array.isArray(a) || !Array.isArray(b)) return false
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false
  return true
}

function isObject(obj: unknown): obj is Record<string, unknown> {
  return (
    typeof obj === 'object' &&
    Object.prototype.toString.call(obj) === '[object Object]'
  )
}
