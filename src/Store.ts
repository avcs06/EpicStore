import memoize from 'memoizee';
import invariant from 'invariant';
import { RicochetError, ErrorMessages } from './errors';
import { INITIAL_VALUE, MERGE_ERROR, freeze, clone, merge, isEqual, isArray, makeApplyChanges } from './object';

import { Epic } from './Epic';
import { Updater, makeUpdater, EpicHandler } from './Updater';
import { getConditionFrom, AnyOfCondition, Condition, ResolvableCondition, AnyCondition, SingleCondition } from './Condition';
import { Action, InputAction, getActionFrom } from './Action';

interface InternalAction extends Action {
    patternRegex?: RegExp;
}

const processAction = ($0: InputAction): InternalAction => {
    const action = getActionFrom($0) as InternalAction;
    const { target } = action;
    if (target) {
        action.target = typeof target === 'string' ? target : target.name;
        if (/\*/.test(action.target))
            action.patternRegex = getRegexFromPattern(action.target);
    }

    return action;
};

interface InternalCondition extends Condition {
    value?: any;
    _value?: any;
    patternRegex?: RegExp;
    alwaysFulfilledWith?: Function;
    fulfilledBy?: { [key: string]: any }
}

const processCondition = ($0: SingleCondition): InternalCondition => {
    const condition = getConditionFrom($0) as InternalCondition;

    if (condition.selector)
        condition.selector = memoize(condition.selector, { max: 1 });

    if (condition.guard)
        condition.guard = memoize(condition.guard, { max: 1 });

    if (/\*/.test(condition.type))
        condition.patternRegex = getRegexFromPattern(condition.type);

    condition.value = INITIAL_VALUE;
    return condition;
};

const getSelectorValue = ({ selector }: Condition, { type, payload }: Action) =>
    selector ? selector(payload, type) : payload;

const getRegexFromPattern = pattern => {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*?') + '$');
    return Object.assign(regex, { _original: pattern });
}

const didConditionChange = condition =>
    condition.hasOwnProperty('_value') && !isEqual(condition._value, condition.value);

const resetOrUpdateEpic = (epic, shouldUpdate) => {
    if (shouldUpdate) {
        epic.state = epic._state;
        epic.scope = epic._scope;
    }

    delete epic._state;
    delete epic._scope;
};

const resetOrUpdateCondition = (condition, shouldUpdate) => {
    if (shouldUpdate && condition.hasOwnProperty('_value')) {
        condition.value = condition._value;
    }

    delete condition._value;
    delete condition.fulfilledBy;
};

const splitNestedValues = ([...values]) => {
    const valuesList = [];
    values.some((value, i) => {
        if (value?.constructor === Array) {
            value.forEach(v => {
                values[i] = v;
                valuesList.push(...splitNestedValues(values))
            });
            return true;
        }
        return false;
    });

    return valuesList.length ? valuesList : [values];
};

const _forEach = (map: Map<string, any[]> = new Map(), iterator) => {
    map.forEach(list => {
        list.forEach(iterator);
    });
};

function alwaysFulfilledWith(epicRegistry) {
    if (this.value === INITIAL_VALUE && epicRegistry[this.type])
        this.value = getSelectorValue(this, {
            type: this.type,
            payload: epicRegistry[this.type].state
        });

    return this.value === INITIAL_VALUE ? undefined : this.value;
}

const UNDO_ACTION = { type: 'STORE_UNDO' };
const REDO_ACTION = { type: 'STORE_REDO' };

interface UndoParams {
    maxStack?: number;
    manualUndoPoints?: boolean;
}

interface StoreParams {
    patterns?: boolean;
    undo?: boolean | UndoParams
}

interface InternalEpic extends Epic {
    _state?: any;
    _scope?: any;
}

interface InternalUpdater extends Updater {
    processed?: boolean
}

type UpdaterList = [InternalUpdater, number][];
type UpdaterMap = Map<string, UpdaterList>;

export class Store {
    private undoEnabled = false;
    private patternsEnabled = false;
    private undoMaxStack;

    private epicRegistry: { [key: string]: InternalEpic } = {};
    private updaterRegistry: Map<string, UpdaterMap> = new Map();
    private pUpdaterRegistry: Map<RegExp, UpdaterMap> = new Map();
    private uRegistries = [this.updaterRegistry, this.pUpdaterRegistry];

    private storeListeners: { [key: string]: UpdaterList } = {};
    private pStoreListeners: { [key: string]: UpdaterList } = {};
    private sRegistries = [this.storeListeners, this.pStoreListeners];

    private undoStack: Function[] = [];
    private redoStack: Function[] = [];

    constructor(options?: StoreParams) {
        this.undoEnabled = Boolean(options?.undo);
        this.patternsEnabled = Boolean(options?.patterns);
        this.undoMaxStack = (options?.undo as UndoParams)?.maxStack || 10;
    }

    register(epic: InternalEpic) {
        const { name, updaters } = epic;
        const error = new RicochetError(name);
        invariant(!this.epicRegistry[name],
            error.get(ErrorMessages.duplicateEpic));

        updaters.forEach(this._addUpdater.bind(this));
        this.epicRegistry[name] = epic;
        epic._registerStore(this);
    }

    unregister(epic: string | Epic) {
        const epicName = (epic as Epic).name || (epic as string);
        const epicObject = this.epicRegistry[epicName] as InternalEpic;

        if (epicObject) {
            delete this.epicRegistry[epicName];
            epicObject._unregisterStore(this);
            epicObject.updaters.forEach(({ conditions }) => {
                conditions.forEach((inputCondition: InternalCondition, i) => {
                    this._processUpdaterCondition(inputCondition, i, false,
                        ({ type, patternRegex }: InternalCondition) => {
                            const key = patternRegex || type;
                            this.uRegistries.forEach((registry: any) => {
                                const conditionMap = registry.get(key)
                                conditionMap && conditionMap.delete(epicName);
                            });
                        });
                });
            });
        }
    }

    _addUpdater(updater: Updater) {
        const { conditions, name, epic: epicName } = updater;
        const error = new RicochetError(epicName, name);

        // validate conditions (Heavy)
        invariant(!conditions.reduce((a, c: AnyCondition) => {
            if (isArray(c))
                invariant((c as AnyOfCondition).every((c1: Condition) => (
                    !c1.readonly && (c1.type || c1) !== '*'
                )), error.get(ErrorMessages.invalidAnyOf));

            const readonly = (c as Condition).readonly
            const type = (c as Condition).type || (c as string);
            invariant(!(/\*/.test(type) && readonly), error.get(ErrorMessages.invalidPattern));
            return a && readonly;
        }, true), error.get(ErrorMessages.noReadonlyUpdaters));

        // register conditions
        updater.conditions = conditions.map((inputCondition: AnyCondition, i) => {
            return this._processUpdaterCondition(inputCondition, i, false,
                ({ type, patternRegex }: InternalCondition) => {
                    let registry: any = this.updaterRegistry;
                    if (this.patternsEnabled && patternRegex)
                        registry = this.pUpdaterRegistry;

                    const key = patternRegex || type;
                    let conditionMap = registry.get(key);
                    if (!conditionMap) registry.set(key, conditionMap = new Map());

                    let conditionList = conditionMap.get(epicName);
                    if (!conditionList) conditionMap.set(epicName, conditionList = []);

                    conditionList.push([updater, i]);
                });
        });
    }

    _removeUpdater(updater: Updater) {
        const { conditions, epic: epicName } = updater;
        conditions.forEach((inputCondition: AnyCondition, i) => {
            this._processUpdaterCondition(inputCondition, i, false,
                ({ type, patternRegex }: InternalCondition) => {
                    const key = patternRegex || type;
                    this.uRegistries.forEach((registry: any) => {
                        const conditionMap = registry.get(key)
                        if (conditionMap) {
                            conditionMap.set(epicName,
                                conditionMap.get(epicName).filter(([u]) => updater !== u));
                        }
                    });
                });
        });
    }

    private _processUpdaterCondition(inputCondition: AnyCondition, i: number, isAnyOf: boolean, callback: Function) {
        if (isArray(inputCondition)) {
            return (inputCondition as AnyOfCondition).map((c: AnyCondition) => {
                return this._processUpdaterCondition(c, i, true, callback);
            }) as AnyOfCondition;
        }

        const condition = processCondition(inputCondition as SingleCondition);
        if (!isAnyOf && !condition.patternRegex && condition.readonly)
            condition.alwaysFulfilledWith =
                alwaysFulfilledWith.bind(condition, this.epicRegistry);

        callback.bind(this)(condition);
        return condition;
    }

    private _processStoreListeners(epicCache, sourceAction, options?) {
        const storeListenerCache = [];
        const postProcessingErrors = [];
        const updatedEpics = Object.keys(epicCache);

        updatedEpics.forEach(epicName => {
            const listeners = this.storeListeners[epicName] || [];
            if (this.patternsEnabled) {
                Object.keys(this.pStoreListeners).forEach(key => {
                    if (getRegexFromPattern(key).test(epicName))
                        listeners.push(...this.pStoreListeners[key]);
                });
            }

            listeners.forEach(([listener]) => {
                if (listener.processed) return;
                listener.processed = true;
                storeListenerCache.push(listener);

                let hasChangedActive = false;
                const { conditions, handler } = listener;

                conditions.forEach((condition: InternalCondition) => {
                    const { type, patternRegex } = condition;
                    const isPattern = !!patternRegex;

                    if (this.patternsEnabled && isPattern) {
                        updatedEpics.forEach(key => {
                            if (patternRegex.test(key)) {
                                if (!condition.fulfilledBy)
                                    condition.fulfilledBy = {};

                                condition.fulfilledBy[key] = getSelectorValue(condition, {
                                    type: key,
                                    payload: epicCache[key]
                                });
                            }
                        });

                        hasChangedActive = hasChangedActive || Boolean(condition.fulfilledBy);
                    } else if (epicCache[type]) {
                        const payload = epicCache[type];
                        condition._value = getSelectorValue(condition, { type, payload });

                        if (!condition.readonly)
                            hasChangedActive = hasChangedActive || didConditionChange(condition);
                    }
                });

                // If there are required conditions all of them should change
                if (hasChangedActive) {
                    if (options) {
                        options.error = new RicochetError(listener.name)
                    }

                    const handlerParams = conditions.map((c: InternalCondition) =>
                        c.patternRegex ? c.fulfilledBy :
                            c.hasOwnProperty('_value') ? c._value :
                                alwaysFulfilledWith.bind(c)(this.epicRegistry)
                    );

                    try {
                        handler(handlerParams, sourceAction);
                    } catch (e) {
                        postProcessingErrors.push(e);
                    }
                }
            });
        });

        storeListenerCache.forEach(listener => {
            listener.conditions.forEach(resetOrUpdateCondition.bind(null, true));
            delete listener.processed;
        });

        return postProcessingErrors;
    }

    dispatch = (() => {
        let sourceAction, epicCache, actionCache, conditionCache, inCycle, afterCycle, undoEntry;
        const options = { error: new RicochetError() };

        const processUpdater = (updater, action, external, pattern?) => {
            const [{ epic: epicName, name, conditions, handler }, conditionIndex] = updater;

            // If action target doesn't match the epicName return
            if (action.target) {
                if (this.patternsEnabled && action.patternRegex) {
                    if (!action.patternRegex.test(epicName)) return
                } else {
                    if (action.target !== epicName) return;
                }
            }

            const originalCondition = conditions[conditionIndex];
            let activeCondition = originalCondition;

            const isPattern = !!pattern;
            const isAnyOf = isArray(activeCondition);

            // if pattern or anyOf, send all matching actions in cycle as payload
            let sendFullAction = isPattern || isAnyOf;

            // if anyof condition, get the matching condition as original condition
            if (isAnyOf) {
                const conditionType = pattern?._original || action.type;
                activeCondition = activeCondition.find(({ type }) => conditionType === type);
            }

            const conditionValue = getSelectorValue(activeCondition, action);

            // If condition has a guard and it returns false, return
            if (activeCondition.guard && !activeCondition.guard(conditionValue, action.type)) return;

            // pattern conditions cannot have _value as prev match
            // and current match can be from completely different epics
            if (!isPattern) {
                activeCondition._value = conditionValue;
                isAnyOf && conditionCache.push(activeCondition);
            }

            // Should always update the epic on pattern or external action
            // If this is an epic action, current epic should be updated only if value is changed
            if (isPattern || external || didConditionChange(activeCondition)) {
                conditionCache.push(originalCondition);

                if (!originalCondition.fulfilledBy)
                    originalCondition.fulfilledBy = {};

                originalCondition.fulfilledBy[action.type] =
                    sendFullAction ? {
                        type: action.type,
                        payload: conditionValue
                    } : conditionValue;
            } else return;

            // If this is readonly condition, there should be atleast one non readonly fulfilled condition
            if (activeCondition.readonly &&
                !conditions.some(c => !c.readonly && c.fulfilledBy)) return;

            // All conditions should either be always fulfilled or fulfilled in the cycle
            if (!conditions.every(condition =>
                condition.fulfilledBy || condition.alwaysFulfilledWith)) return;

            const handlerParams = conditions.map((c, i) => {
                if (i === conditionIndex)
                    return originalCondition.fulfilledBy[action.type];
                else if (c.fulfilledBy)
                    return Object.values(c.fulfilledBy);
                else
                    return c.alwaysFulfilledWith();
            });

            // to throw error if handler dispatches a new action
            options.error = new RicochetError(epicName, name);

            const epic = this.epicRegistry[epicName];
            epic._state = epic.hasOwnProperty('_state') ? epic._state : epic.state;
            epic._scope = epic.hasOwnProperty('_scope') ? epic._scope : epic.scope;

            let stateUpdated = false;
            splitNestedValues(handlerParams).forEach(handlerParams => {
                const handlerUpdate = handler.call(epic, handlerParams, sourceAction);
                const handleUpdate = (entity, callback = Function.prototype) => {
                    if (handlerUpdate.hasOwnProperty(entity)) {
                        let updatedValue, changes;
                        try {
                            [updatedValue, changes] =
                                merge(clone(epic['_' + entity]), handlerUpdate[entity], this.undoEnabled);
                        } catch (e) {
                            invariant(e !== MERGE_ERROR,
                                new RicochetError(epicName, name).get(ErrorMessages.invalidHandlerUpdate));
                            throw e;
                        }

                        epic['_' + entity] = freeze(updatedValue);
                        if (this.undoEnabled) {
                            const { undo: undoChange, redo: redoChange } = changes;
                            undoEntry[epicName] = {
                                ...(undoEntry[epicName] || {}),
                                [entity]: { undo: undoChange, redo: redoChange }
                            };
                        }

                        callback();
                    }
                };

                handleUpdate('scope');
                handleUpdate('state', () => {
                    epicCache[epicName] = epic._state;
                    if (pattern !== '*' && !handlerUpdate.passive) {
                        stateUpdated = true;
                    }
                });
            });

            if (stateUpdated)
                executeAction(new Action(epicName, epic._state), false);
        }

        const executeAction = (action, external) => {
            if (external) {
                // throw if epic is triggered as an external action
                invariant(!this.epicRegistry[action.type],
                    new RicochetError(action.type).get(ErrorMessages.invalidEpicAction));

               /*  // throw if repeated external action in same cycle
                invariant(!actionCache.hasOwnProperty(action.type),
                    new RicochetError(action.type).get(ErrorMessages.noRepeatedExternalAction)); */

                actionCache[action.type] = action.payload;
            }

            // handle direct updaters
            _forEach(this.updaterRegistry.get(action.type), updater => {
                processUpdater(updater, action, external);
            });

            // handle pattern updaters
            if (this.patternsEnabled) {
                this.pUpdaterRegistry.forEach((updaterMap, pattern) => {
                    if (pattern.test(action.type)) {
                        _forEach(updaterMap, updater => {
                            processUpdater(updater, action, external, pattern);
                        });
                    }
                });
            }
        }

        return (action: string | Action) => {
            // validate action
            action = processAction(action);

            // No actions should be dispatched from epic updaters
            invariant(!inCycle, options.error.get(ErrorMessages.noDispatchInEpicUpdater));

            // No actions should be dispatched from epic listeners
            invariant(!afterCycle, options.error.get(ErrorMessages.noDispatchInEpicListener));

            // Fresh dispatch cycle
            inCycle = true;
            undoEntry = {};
            epicCache = {};
            actionCache = {};
            conditionCache = [];
            sourceAction = action;

            // dipatch cycle
            let processingError;
            try {
                executeAction(action, true);
            } catch (e) {
                processingError = e;
            }

            // End of dispatch cycle
            inCycle = false;
            const isSuccessfulCycle = !processingError;

            // Update or reset conditions
            conditionCache.forEach(condition => {
                resetOrUpdateCondition(condition, isSuccessfulCycle);
            });

            // Update or reset epics
            Object.keys(epicCache).forEach(epicName => {
                resetOrUpdateEpic(this.epicRegistry[epicName], isSuccessfulCycle);
            });

            // update undo entry
            if (isSuccessfulCycle) {
                if (this.undoEnabled) {
                    // always clear redostack on user change
                    this.redoStack = [];

                    // If fresh undopoint create a new entry, else merge to previous entry
                    if ((action as Action).createUndoPoint || !this.undoStack.length) {
                        if (this.undoStack.length === this.undoMaxStack)
                            this.undoStack.shift();

                        this.undoStack.push(undoEntry);
                    } else {
                        const currentEntry = undoEntry;
                        const previousEntry = this.undoStack[this.undoStack.length - 1];
                        Object.keys(currentEntry).forEach(epic => {
                            if (!previousEntry[epic]) {
                                previousEntry[epic] = currentEntry[epic];
                            } else {
                                ['state', 'scope'].forEach(entity => {
                                    const pEntry = previousEntry[epic][entity];
                                    const cEntry = currentEntry[epic][entity];
                                    if (pEntry && cEntry) {
                                        pEntry.undo = makeApplyChanges([cEntry.undo, pEntry.undo]);
                                        pEntry.redo = makeApplyChanges([pEntry.redo, cEntry.redo]);
                                    } else {
                                        previousEntry[epic][entity] = pEntry || cEntry;
                                    }
                                });
                            }
                        });
                    }
                }
            } else {
                // After everything is reset throw the caught errors
                throw processingError;
            }

            // handle epic listeners
            afterCycle = true;
            const postProcessingErrors =
                this._processStoreListeners(epicCache, sourceAction, options);

            afterCycle = false;
            if (postProcessingErrors.length)
                throw postProcessingErrors;
        };
    })();

    on(condition: AnyCondition | ResolvableCondition, handler: Function) {
        const updater = makeUpdater(condition, handler as EpicHandler);
        const { conditions } = updater;

        // register conditions
        updater.conditions = conditions.map((inputCondition: AnyCondition, i) => {
            return this._processUpdaterCondition(inputCondition, i, false,
                ({ type, patternRegex }: InternalCondition) => {
                    let registry = this.storeListeners;
                    if (this.patternsEnabled && patternRegex)
                        registry = this.pStoreListeners;

                    if (!registry[type]) registry[type] = [];
                    registry[type].push([updater, i]);
                });
        });

        return () => this._off(updater);;
    }

    private _off(updater: Updater) {
        [this.storeListeners, this.pStoreListeners].forEach(registry => {
            updater.conditions.forEach(({ type }: InternalCondition) => {
                registry[type] &&
                    (registry[type] =
                        registry[type].filter(([u]) => updater !== u));
            });
        });
    }

    private _handleUndoChange(from, to, key) {
        const entry = from.pop();
        const epicCache = {};
        if (!entry) return epicCache;

        Object.keys(entry).forEach(epicName => {
            const epic = this.epicRegistry[epicName];
            const epicEntry = entry[epicName];
            ['state', 'scope'].forEach(entity => {
                if (epicEntry[entity]) {
                    epic[entity] = freeze(epicEntry[entity][key](clone(epic[entity])));
                }
            });
            epicCache[epicName] = epic.state;
        });

        to.push(entry);
        return epicCache;
    }

    get undo() {
        if (this.undoEnabled) {
            return () => {
                const epicCache = this._handleUndoChange(this.undoStack, this.redoStack, 'undo');
                this._processStoreListeners(epicCache, UNDO_ACTION);
            };
        }
    }

    get redo() {
        if (this.undoEnabled) {
            return () => {
                const epicCache = this._handleUndoChange(this.redoStack, this.undoStack, 'redo');
                this._processStoreListeners(epicCache, REDO_ACTION);
            };
        }
    }

    private _getEpic(epicName, key) {
        const epic = this.epicRegistry[epicName];
        return epic ? epic[key] : null;
    }

    getEpicState(epicName) {
        return this._getEpic(epicName, 'state');
    }

    getEpicScope(epicName) {
        return this._getEpic(epicName, 'scope');
    }

    _getUpdaterConditions(epicName, name) {
        const updaters = this._getEpic(epicName, 'updaters');
        const updater = (updaters || []).find(({ name: n }) => name === n);
        return updater?.conditions.map(condition => ({ ...condition }));
    }

    getStoreListeners(conditionType) {
        return (this.storeListeners[conditionType] || this.pStoreListeners[conditionType]).map(([updater]) => {
            return {
                ...updater,
                conditions: updater.conditions.map((condition: InternalCondition) => ({ ...condition }))
            };
        });
    }
}
