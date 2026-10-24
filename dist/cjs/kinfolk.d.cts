import React, { type DependencyList, type ReactNode } from 'react';
declare const atomType: unique symbol;
declare const selectorType: unique symbol;
export interface Atom<T> {
    (): T;
    label?: string;
    readonly [atomType]: true;
}
export interface Selector<T, A = void> {
    (arg: A): T;
    label?: string;
    readonly [selectorType]: true;
}
export type Update<T> = T | ((state: T) => T);
export interface AtomOptions {
    label?: string;
}
export interface SelectorOptions<T> extends AtomOptions {
    equal?: (previous: T, next: T) => boolean;
    persist?: boolean;
}
export type UseSelectorOptions<T> = Omit<SelectorOptions<T>, 'persist'>;
export interface ProviderProps {
    store?: Store;
    children?: ReactNode;
}
type Ref = {
    label?: string;
};
type AtomMeta = {
    kind: 'atom';
    initialState: unknown;
};
type SelectorMeta = {
    kind: 'selector';
    selectorFn: (arg: unknown) => unknown;
    equal: (previous: unknown, next: unknown) => boolean;
    persist: boolean;
};
type Meta = AtomMeta | SelectorMeta;
type Input = {
    atomRef: Ref;
    arg: unknown;
    value: unknown;
};
type Memo = {
    value: unknown;
    inputs: Input[];
};
type CommonState = {
    listeners: Set<() => void>;
    parents: Set<Ref>;
    children: Set<Ref>;
    label: string;
};
type AtomState = CommonState & {
    kind: 'atom';
    state: unknown;
};
type SelectorState = CommonState & SelectorMeta & {
    memo: Map<unknown, Memo>;
};
type State = AtomState | SelectorState;
declare class AtomStates extends Map<Ref, State> {
    readonly pending: WeakMap<Ref, SelectorState>;
}
export interface Store {
    /** Internal maps exposed for debugging, not a stable public API. */
    atomMetas: WeakMap<object, Meta>;
    atomStates: AtomStates;
    get<T>(ref: Atom<T> | Selector<T>): T;
    get<T, A>(ref: Selector<T, A>, arg: A): T;
    set<T>(ref: Atom<T>, value: Update<T>): void;
    debug(): Record<string, unknown> & {
        __selectors: Record<string, unknown>;
    };
}
export declare function createContext(): {
    atom: typeof atom;
    selector: typeof selector;
    Provider: ({ store, children }: ProviderProps) => React.JSX.Element;
    useSelector: <T>(selectorFnOrRef: () => T, deps?: DependencyList, options?: UseSelectorOptions<T>) => T;
    useSetter: <T>(atomRef: Atom<T>) => (action: Update<T>) => void;
    useReducer: <T, A = void>(atomRef: Atom<T>, reducer: (state: T, action: A) => T) => (action: A) => void;
};
export declare const Provider: ({ store, children }: ProviderProps) => React.JSX.Element, useSelector: <T>(selectorFnOrRef: () => T, deps?: DependencyList, options?: UseSelectorOptions<T>) => T, useSetter: <T>(atomRef: Atom<T>) => (action: Update<T>) => void, useReducer: <T, A = void>(atomRef: Atom<T>, reducer: (state: T, action: A) => T) => (action: A) => void;
export declare function atom<T>(initialState: T, { label }?: AtomOptions): Atom<T>;
export declare function selector<T, A = void>(selectorFn: (arg: A) => T, { label, equal, persist }?: SelectorOptions<T>): Selector<T, A>;
export declare function createStore(): Store;
export {};
