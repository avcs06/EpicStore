import memoize from 'memoizee'
import invariant from 'invariant'
import * as utils from './object'

import { makeUpdater } from './reducer'
import { getActionFrom, withPayload } from './action'
import { getConditionFrom } from './condition'
import { RicochetError, ErrorMessages } from './errors'
import { registerStoreToEpic, unregisterStoreFromEpic } from './epicStore'

import type {
    Action, InputAction,
    Condition, InputCondition,
    AnyCondition, AnyOfCondition, ResolvableCondition,
    Epic, Reducer, Store, StoreHandler, ReducerHandler, StoreParams, StoreMetaInfo, UndoParams, InternalEpic, InternalAction, InternalCondition
} from './types'

const {
    INITIAL_VALUE, MERGE_ERROR,
    freeze, clone, merge, isEqual,
    isArray, makeApplyChanges
} = utils

const getRegexFromPattern = pattern => {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*?') + '$')
    return Object.assign(regex, { _original: pattern })
}

const processAction = ($0: InputAction): InternalAction => {
    const action = getActionFrom($0) as InternalAction
    const { target } = action
    if (target) {
        action.target = typeof target === 'string' ? target : target.name

        if (/\*/.test(action.target)) {
            action.patternRegex = getRegexFromPattern(action.target)
        }
    }

    return action
}

const processCondition = ($0: InputCondition): InternalCondition => {
    const condition = getConditionFrom($0) as InternalCondition

    if (condition.selector) {
        condition.selector = memoize(condition.selector, { max: 1 })
    }

    if (condition.guard) {
        condition.guard = memoize(condition.guard, { max: 1 })
    }

    if (/\*/.test(condition.type)) {
        condition.patternRegex = getRegexFromPattern(condition.type)
    }

    condition.value = INITIAL_VALUE
    return condition
}

const getSelectorValue = ({ selector }: Condition, { type, payload }: Action) =>
    selector ? selector(payload, type) : payload

const didConditionChange = condition =>
    condition.hasOwnProperty('_value') && !isEqual(condition._value, condition.value)

const resetOrUpdateEpic = (epic, shouldUpdate) => {
    if (shouldUpdate) {
        epic.state = epic._state
        epic.scope = epic._scope
    }

    delete epic._state
    delete epic._scope
}

const resetOrUpdateCondition = (condition, shouldUpdate) => {
    if (shouldUpdate && condition.hasOwnProperty('_value')) {
        condition.value = condition._value
    }

    delete condition._value
    delete condition.fulfilledBy
}

export const splitNestedValues = ([...values]) => {
    const valuesList = []
    values.some((value, i) => {
        if (value?.constructor === Array) {
            value.forEach(v => {
                values[i] = v
                valuesList.push(...splitNestedValues(values))
            })
            return true
        }
        return false
    })

    return valuesList.length ? valuesList : [values]
}

const _forEachUpdater = (map: Map<string, any[]> = new Map(), iterator) => {
    map.forEach(list => {
        list.forEach(iterator)
    })
}

const _mapCondition = (conditions, callback) => {
    return conditions.map((condition: AnyCondition, i) => {
        if (isArray(condition)) {
            return (condition as AnyOfCondition).map((c: AnyCondition) => {
                return callback(c, i, true)
            }) as AnyOfCondition
        }

        return callback(condition, i, false)
    })
}

const UNDO_ACTION = { type: 'STORE_UNDO' }
const REDO_ACTION = { type: 'STORE_REDO' }

const makeStoreMetaInfo = (options?: StoreParams):StoreMetaInfo => {
    return {
        undoEnabled: Boolean(options?.undo),
        patternsEnabled: Boolean(options?.patterns),
        undoMaxStack: (options?.undo as UndoParams)?.maxStack || 10,

        epicRegistry: {},
        pendingEpics: new Set(),

        updaterRegistry: new Map(),
        pUpdaterRegistry: new Map(),
        get uRegistries () {
            return [this.updaterRegistry, this.pUpdaterRegistry]
        },

        storeListeners: {},
        pStoreListeners: {},
        get sRegistries () {
            return [this.storeListeners, this.pStoreListeners]
        },

        undoStack: [],
        redoStack: []
    }
}

export const addUpdaterToStore = ({ meta }: Store, updater: Reducer) => {
    const { conditions, name, epic: epicName } = updater
    const error = new RicochetError(epicName, name)

    // validate conditions (Heavy)
    invariant(!conditions.reduce((a, c: AnyCondition) => {
        if (isArray(c)) {
            invariant((c as Condition[]).every(c1 => (
                !c1.readonly && (c1.type || c1) !== '*'
            )), error.get(ErrorMessages.invalidAnyOf))
        }

        const readonly = (c as Condition).readonly
        const type = (c as Condition).type || (c as string)
        invariant(!(/\*/.test(type) && readonly), error.get(ErrorMessages.invalidPattern))
        return a && readonly
    }, true), error.get(ErrorMessages.noReadonlyUpdaters))

    // register conditions
    updater.conditions = _mapCondition(conditions, (inputCondition: InputCondition, i, isAnyOf) => {
        const condition = processCondition(inputCondition)
        const { patternRegex, type } = condition

        if (!isAnyOf && !patternRegex) {
            if (meta.epicRegistry[type]) {
                condition.value = getSelectorValue(condition, {
                    type, payload: meta.epicRegistry[type].state
                })
            } else meta.pendingEpics.add(type)
        }

        let registry: any = meta.updaterRegistry
        if (meta.patternsEnabled && patternRegex) { registry = meta.pUpdaterRegistry }

        const key = patternRegex || type
        let conditionMap = registry.get(key)
        if (!conditionMap) registry.set(key, conditionMap = new Map())

        let conditionList = conditionMap.get(epicName)
        if (!conditionList) conditionMap.set(epicName, conditionList = [])

        conditionList.push([updater, i])
        return condition
    })
}

export const removeUpdaterFromStore = ({ meta }: Store, updater: Reducer) => {
    const { conditions, epic: epicName } = updater
    _mapCondition(conditions, ({ type, patternRegex }) => {
        const key = patternRegex || type
        meta.uRegistries.forEach((registry: any) => {
            const conditionMap = registry.get(key)
            if (conditionMap) {
                conditionMap.set(epicName,
                    conditionMap.get(epicName).filter(([u]) => updater !== u))
            }
        })
    })
}

const processStoreListeners = ({ meta }: Store, epicCache, sourceAction, options?) => {
    const storeListenerCache = []
    const postProcessingErrors = []
    const updatedEpics = Object.keys(epicCache)

    updatedEpics.forEach(epicName => {
        const listeners = meta.storeListeners[epicName] || []
        if (meta.patternsEnabled) {
            Object.keys(meta.pStoreListeners).forEach(key => {
                if (getRegexFromPattern(key).test(epicName)) { listeners.push(...meta.pStoreListeners[key]) }
            })
        }

        listeners.forEach(([listener]) => {
            if (listener.processed) return
            listener.processed = true
            storeListenerCache.push(listener)

            let hasChangedActive = false
            const { conditions, handler } = listener;

            (conditions as InternalCondition[]).forEach(condition => {
                const { type, patternRegex } = condition
                const isPattern = !!patternRegex

                if (meta.patternsEnabled && isPattern) {
                    updatedEpics.forEach(key => {
                        if (patternRegex.test(key)) {
                            if (!condition.fulfilledBy) { condition.fulfilledBy = {} }

                            condition.fulfilledBy[key] = getSelectorValue(condition, {
                                type: key,
                                payload: epicCache[key]
                            })
                        }
                    })

                    hasChangedActive = hasChangedActive || Boolean(condition.fulfilledBy)
                } else if (epicCache[type]) {
                    const payload = epicCache[type]
                    condition._value = getSelectorValue(condition, { type, payload })

                    if (!condition.readonly) { hasChangedActive = hasChangedActive || didConditionChange(condition) }
                }
            })

            // If there are required conditions all of them should change
            if (hasChangedActive) {
                if (options) {
                    options.error = new RicochetError(listener.name)
                }

                const handlerParams = (conditions as InternalCondition[]).map(c => (
                    c.patternRegex
                        ? c.fulfilledBy
                        : c.hasOwnProperty('_value') ? c._value : c.value
                ))

                try {
                    handler(handlerParams, sourceAction)
                } catch (e) {
                    postProcessingErrors.push(e)
                }
            }
        })
    })

    storeListenerCache.forEach(listener => {
        listener.conditions.forEach(resetOrUpdateCondition.bind(null, true))
        delete listener.processed
    })

    return postProcessingErrors
}

const handleUndoChange = ({ meta }: Store, from, to, key) => {
    const entry = from.pop()
    const epicCache = {}
    if (!entry) return epicCache

    Object.keys(entry).forEach(epicName => {
        const epic = meta.epicRegistry[epicName]
        const epicEntry = entry[epicName];
        ['state', 'scope'].forEach(entity => {
            if (epicEntry[entity]) {
                epic[entity] = freeze(epicEntry[entity][key](clone(epic[entity])))
            }
        })
        epicCache[epicName] = epic.state
    })

    to.push(entry)
    return epicCache
}

export const createStore = (options?: StoreParams): Store => {
    const meta = makeStoreMetaInfo(options)
    const store = { meta }

    return Object.assign(store, {
        register (epic) {
            const { name, reducers, state } = epic
            const error = new RicochetError(name)
            invariant(!meta.epicRegistry[name],
                error.get(ErrorMessages.duplicateEpic))

            reducers.forEach(addUpdaterToStore.bind(null, this))
            meta.epicRegistry[name] = epic
            registerStoreToEpic(epic, this)

            if (meta.pendingEpics.has(name)) {
                meta.pendingEpics.delete(name)

                const iterator = ([updater, i]) =>
                    (updater[i].value = getSelectorValue(updater[i], {
                        type: name, payload: state
                    }))

                _forEachUpdater(meta.updaterRegistry.get(name), iterator)
                meta.storeListeners[name].forEach(iterator)
            }
        },

        unregister (epic) {
            const epicName = (epic as Epic).name || (epic as string)
            const epicObject = meta.epicRegistry[epicName] as InternalEpic

            if (epicObject) {
                delete meta.epicRegistry[epicName]
                unregisterStoreFromEpic(epicObject, this)
                epicObject.reducers.forEach(({ conditions }) => {
                    _mapCondition(conditions, ({ type, patternRegex }) => {
                        const key = patternRegex || type
                        meta.uRegistries.forEach((registry: any) => {
                            const conditionMap = registry.get(key)
                            conditionMap && conditionMap.delete(epicName)
                        })
                    })
                })
            }
        },

        dispatch: (() => {
            let sourceAction, epicCache, actionCache, conditionCache, inCycle, afterCycle, undoEntry
            const options = { error: new RicochetError() }

            const processUpdater = (updater, action, external, pattern?): Action => {
                const [{ epic: epicName, name, conditions, handler }, conditionIndex] = updater

                // If action target doesn't match the epicName return
                if (action.target) {
                    if (meta.patternsEnabled && action.patternRegex) {
                        if (!action.patternRegex.test(epicName)) return
                    } else {
                        if (action.target !== epicName) return
                    }
                }

                const originalCondition = conditions[conditionIndex]
                let activeCondition = originalCondition

                const isPattern = !!pattern
                const isAnyOf = isArray(activeCondition)

                // if pattern or anyOf, send all matching actions in cycle as payload
                const sendFullAction = isPattern || isAnyOf

                // if anyof condition, get the matching condition as original condition
                if (isAnyOf) {
                    const conditionType = pattern?._original || action.type
                    activeCondition = activeCondition.find(({ type }) => conditionType === type)
                }

                const conditionValue = getSelectorValue(activeCondition, action)

                // If condition has a guard and it returns false, return
                if (activeCondition.guard && !activeCondition.guard(conditionValue, action.type)) return

                // pattern conditions cannot have _value as prev match
                // and current match can be from completely different epics
                if (!isPattern) {
                    activeCondition._value = conditionValue
                    isAnyOf && conditionCache.push(activeCondition)
                }

                // Should always update the epic on pattern or external action
                // If meta is an epic action, current epic should be updated only if value is changed
                if (isPattern || external || didConditionChange(activeCondition)) {
                    conditionCache.push(originalCondition)

                    if (!originalCondition.fulfilledBy) { originalCondition.fulfilledBy = {} }

                    originalCondition.fulfilledBy[action.type] =
                        sendFullAction
                            ? {
                                type: action.type,
                                payload: conditionValue
                            }
                            : conditionValue
                } else return

                // If meta is readonly condition, there should be atleast one non readonly fulfilled condition
                if (activeCondition.readonly &&
                    !conditions.some(c => !c.readonly && c.fulfilledBy)) return

                // All conditions should either be always fulfilled or fulfilled in the cycle
                if (!conditions.every(condition =>
                    condition.fulfilledBy || condition.readonly)) return

                const handlerParams = conditions.map((c, i) => {
                    if (i === conditionIndex) { return originalCondition.fulfilledBy[action.type] } else if (c.fulfilledBy) { return Object.values(c.fulfilledBy) } else { return c.value }
                })

                // to throw error if handler dispatches a new action
                options.error = new RicochetError(epicName, name)

                const epic = meta.epicRegistry[epicName]
                epic._state = epic.hasOwnProperty('_state') ? epic._state : epic.state
                epic._scope = epic.hasOwnProperty('_scope') ? epic._scope : epic.scope

                let stateUpdated = false
                splitNestedValues(handlerParams).forEach(handlerParams => {
                    const handlerUpdate = handler.call(epic, handlerParams, sourceAction) || {}
                    const handleUpdate = (entity, callback = Function.prototype) => {
                        if (handlerUpdate.hasOwnProperty(entity)) {
                            let updatedValue, changes
                            try {
                                [updatedValue, changes] =
                                    merge(clone(epic['_' + entity]), handlerUpdate[entity], meta.undoEnabled)
                            } catch (e) {
                                invariant(e !== MERGE_ERROR,
                                    new RicochetError(epicName, name).get(ErrorMessages.invalidHandlerUpdate))
                                throw e
                            }

                            epic['_' + entity] = freeze(updatedValue)
                            if (meta.undoEnabled) {
                                const { undo: undoChange, redo: redoChange } = changes
                                undoEntry[epicName] = {
                                    ...(undoEntry[epicName] || {}),
                                    [entity]: { undo: undoChange, redo: redoChange }
                                }
                            }

                            callback()
                        }
                    }

                    handleUpdate('scope')
                    handleUpdate('state', () => {
                        epicCache[epicName] = epic._state
                        if (pattern !== '*' && !handlerUpdate.passive) {
                            stateUpdated = true
                        }
                    })
                })

                if (stateUpdated) {
                    return withPayload(epicName, epic._state)
                }
            }

            const executeAction = (action, external) => {
                if (external) {
                    // throw if epic is triggered as an external action
                    invariant(!meta.epicRegistry[action.type],
                        new RicochetError(action.type).get(ErrorMessages.invalidEpicAction))

                    /*  // throw if repeated external action in same cycle
                    invariant(!actionCache.hasOwnProperty(action.type),
                        new RicochetError(action.type).get(ErrorMessages.noRepeatedExternalAction)) */

                    actionCache[action.type] = action.payload
                }

                // handle direct updaters
                _forEachUpdater(meta.updaterRegistry.get(action.type), updater => {
                    const epicAction = processUpdater(updater, action, external)
                    epicAction && executeAction(epicAction, false)
                })

                // handle pattern updaters
                if (meta.patternsEnabled) {
                    meta.pUpdaterRegistry.forEach((updaterMap, pattern) => {
                        if (pattern.test(action.type)) {
                            _forEachUpdater(updaterMap, updater => {
                                const epicAction = processUpdater(updater, action, external, pattern)
                                epicAction && executeAction(epicAction, false)
                            })
                        }
                    })
                }
            }

            return function (action) {
                // validate action
                action = processAction(action)

                // No actions should be dispatched from epic updaters
                invariant(!inCycle, options.error.get(ErrorMessages.noDispatchInEpicUpdater))

                // No actions should be dispatched from epic listeners
                invariant(!afterCycle, options.error.get(ErrorMessages.noDispatchInEpicListener))

                // Fresh dispatch cycle
                inCycle = true
                undoEntry = {}
                epicCache = {}
                actionCache = {}
                conditionCache = []
                sourceAction = action

                // dipatch cycle
                let processingError
                try {
                    executeAction(action, true)
                } catch (e) {
                    processingError = e
                }

                // End of dispatch cycle
                inCycle = false
                const isSuccessfulCycle = !processingError

                // Update or reset conditions
                conditionCache.forEach(condition => {
                    resetOrUpdateCondition(condition, isSuccessfulCycle)
                })

                // Update or reset epics
                Object.keys(epicCache).forEach(epicName => {
                    resetOrUpdateEpic(meta.epicRegistry[epicName], isSuccessfulCycle)
                })

                // update undo entry
                if (isSuccessfulCycle) {
                    if (meta.undoEnabled) {
                        // always clear redostack on user change
                        meta.redoStack = []

                        // If fresh undopoint create a new entry, else merge to previous entry
                        if ((action as Action).createUndoPoint || !meta.undoStack.length) {
                            if (meta.undoStack.length === meta.undoMaxStack) { meta.undoStack.shift() }

                            meta.undoStack.push(undoEntry)
                        } else {
                            const currentEntry = undoEntry
                            const previousEntry = meta.undoStack[meta.undoStack.length - 1]
                            Object.keys(currentEntry).forEach(epic => {
                                if (!previousEntry[epic]) {
                                    previousEntry[epic] = currentEntry[epic]
                                } else {
                                    ['state', 'scope'].forEach(entity => {
                                        const pEntry = previousEntry[epic][entity]
                                        const cEntry = currentEntry[epic][entity]
                                        if (pEntry && cEntry) {
                                            pEntry.undo = makeApplyChanges([cEntry.undo, pEntry.undo])
                                            pEntry.redo = makeApplyChanges([pEntry.redo, cEntry.redo])
                                        } else {
                                            previousEntry[epic][entity] = pEntry || cEntry
                                        }
                                    })
                                }
                            })
                        }
                    }
                } else {
                    // After everything is reset throw the caught errors
                    throw processingError
                }

                // handle epic listeners
                afterCycle = true
                const postProcessingErrors =
                    processStoreListeners(this, epicCache, sourceAction, options)

                afterCycle = false
                if (postProcessingErrors.length) { throw postProcessingErrors }
            }
        })(),

        addListener (condition, handler) {
            const updater = makeUpdater(condition, handler as ReducerHandler)
            const { conditions } = updater

            // register conditions
            updater.conditions = _mapCondition(conditions, (inputCondition: InputCondition, i) => {
                const condition = processCondition(inputCondition)
                const { type, patternRegex } = condition

                if (!patternRegex) {
                    if (meta.epicRegistry[type]) {
                        condition.value = getSelectorValue(condition, {
                            type, payload: meta.epicRegistry[type].state
                        })
                    } else meta.pendingEpics.add(type)
                }

                let registry = meta.storeListeners
                if (meta.patternsEnabled && patternRegex) { registry = meta.pStoreListeners }

                if (!registry[type]) registry[type] = []
                registry[type].push([updater, i])
                return condition
            })

            return () => {
                meta.sRegistries.forEach(registry => {
                    _mapCondition(updater.conditions, ({ type }) => {
                        registry[type] &&
                            (registry[type] =
                                registry[type].filter(([u]) => updater !== u))
                    })
                })
            }
        },

        get undo () {
            if (meta.undoEnabled) {
                return () => {
                    const epicCache = handleUndoChange(this, meta.undoStack, meta.redoStack, 'undo')
                    processStoreListeners(this, epicCache, UNDO_ACTION)
                }
            }
        },

        get redo () {
            if (meta.undoEnabled) {
                return () => {
                    const epicCache = handleUndoChange(this, meta.redoStack, meta.undoStack, 'redo')
                    processStoreListeners(this, epicCache, REDO_ACTION)
                }
            }
        }
    })
}

// debug utils
const getEpic = ({ meta }: Store, epicName, key) => {
    const epic = meta.epicRegistry[epicName]
    return epic ? epic[key] : null
}

export const getEpicState = (store: Store, epicName) => {
    return getEpic(store, epicName, 'state')
}

export const getEpicScope = (store: Store, epicName) => {
    return getEpic(store, epicName, 'scope')
}

export const getStoreListeners = ({ meta }: Store, conditionType) => {
    return (meta.storeListeners[conditionType] || meta.pStoreListeners[conditionType]).map(([updater]) => {
        return {
            ...updater,
            conditions: (updater.conditions as InternalCondition[])
                .map((condition: InternalCondition) => ({ ...condition }))
        }
    })
}
