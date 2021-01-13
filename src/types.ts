// Actions
export interface Action {
    type: string
    payload?: any
    target?: string | Epic
    createUndoPoint?: boolean
    skipUndoPoint?: boolean
}

export type InputAction = string | Action

// Conditions
export interface Condition {
    type: string
    readonly?: boolean
    guard?: (value: any, type: string) => boolean
    selector?: (payload: any, type: string) => any
}

export type InputCondition = string | Epic | Condition
export type AnyOfCondition = InputCondition[]
export type AnyCondition = InputCondition | AnyOfCondition

interface Resolvable { __ricochet_resolve: boolean }
type ResolvableArrayCondition = AnyCondition[]
type ResolvableObjectCondition = { [key: string]: AnyCondition }

export type ResolvableInputCondition = ResolvableArrayCondition | ResolvableObjectCondition
export type ResolvableCondition = ResolvableArrayCondition & Resolvable | ResolvableObjectCondition & Resolvable
export type ReducerCondition = AnyCondition | ResolvableCondition

// Reducers
interface ReducerResponse {
    state?: any
    scope?: any
    actions?: InputAction[]
    passive?: boolean
}

export interface ReducerHandler {
    (values: any, metadata?: any): ReducerResponse | void
}

export interface Reducer {
    epic?: string
    name: string
    handler: ReducerHandler
    conditions: AnyCondition[]
}

// Epic
export interface Epic {
    readonly name: string
    readonly state: any
    readonly scope: any
    readonly reducers: Reducer[]
    readonly useState: ((state: any) => void)
    readonly useScope: ((scope: any) => void)
    readonly useReducer: (condition: ReducerCondition, handler: ReducerHandler) => () => void
}

// Store
export interface InternalAction extends Action {
    patternRegex?: RegExp
}

export interface InternalCondition extends Condition {
    value?: any
    _value?: any
    patternRegex?: RegExp
    fulfilledBy?: { [key: string]: any }
}

export interface UndoParams {
    maxStack?: number
    manualUndoPoints?: boolean
}

export interface StoreParams {
    patterns?: boolean
    undo?: boolean | UndoParams
}

export interface InternalEpic extends Epic {
    _state?: any
    _scope?: any
}

interface InternalUpdater extends Reducer {
    processed?: boolean
}

type ReducerList = [InternalUpdater, number][]
type ReducerMap = Map<string, ReducerList>

export interface StoreMetaInfo {
    undoEnabled: boolean
    manualUndoPoints: boolean

    patternsEnabled: boolean
    undoMaxStack: number

    epicRegistry: { [key: string]: InternalEpic }
    pendingEpics: Set<string>

    updaterRegistry: Map<string, ReducerMap>
    pUpdaterRegistry: Map<RegExp, ReducerMap>
    readonly uRegistries: any[]

    storeListeners: { [key: string]: ReducerList }
    pStoreListeners: { [key: string]: ReducerList }
    readonly sRegistries: any[]

    undoStack: (() => void)[]
    redoStack: (() => void)[]
}

export interface StoreHandler {
    (values: any, metadata?: any): void
}

export interface Store {
    readonly meta: StoreMetaInfo
    readonly register: (epic: InternalEpic) => void
    readonly unregister: (epic: string | Epic) => void
    readonly dispatch: (action: InputAction) => void
    readonly addListener: (condition: ReducerCondition, handler: StoreHandler) => () => void
    readonly undo: () => void
    readonly redo: () => void
}
