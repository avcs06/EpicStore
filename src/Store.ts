import memoize from 'memoizee';
import invariant from 'invariant';
import { Error, ErrorMessages } from './Error';
import { INITIAL_VALUE, MERGE_ERROR, freeze, clone, merge, isEqual, isArray, makeApplyChanges } from './object';

import { Epic } from './Epic';
import { Updater, makeUpdater, EpicHandler } from './Updater';
import { getConditionFrom, AnyOfCondition, Condition, ResolvableCondition, resolve, AnyCondition, SingleCondition } from './Condition';
import { Action, InputAction, getActionFrom } from './Action';

interface InternalAction extends Action {
    isPattern?: boolean;
}

const processAction = ($0: InputAction): InternalAction => {
    const action = getActionFrom($0) as InternalAction;
    const { target } = action;
    if (target) {
        action.target = typeof target === 'string' ? target : target.name;
        action.isPattern = /\*/.test(action.target);
    }

    return action;
};

interface InternalCondition extends Condition {
    value?: any;
    _value?: any;
    isPattern?: boolean;
    alwaysFulfilledWith?: Function;
    fulfilledBy?: { [key: string]: any }
}

const processCondition = ($0: SingleCondition): InternalCondition => {
    const condition = getConditionFrom($0) as InternalCondition;

    if (condition.selector)
        condition.selector = memoize(condition.selector, { max: 1 });

    condition.isPattern = /\*/.test(condition.type)
    condition.value = INITIAL_VALUE;
    return condition;
};

const getSelectorValue = ({ selector }: Condition, { type, payload }: Action) =>
    selector ? selector(payload, type) : payload;

const getRegexFromPattern = pattern =>
    new RegExp('^' + pattern.replace(/\*/g, '.*?') + '$');

const didConditionChange = condition =>
    condition.hasOwnProperty('_value') && !isEqual(condition._value, condition.value);

const resetOrUpdateEpic = function (epic, shouldUpdate) {
    if (shouldUpdate) {
        epic.state = epic._state;
        epic.scope = epic._scope;
    }

    delete epic._state;
    delete epic._scope;
};

const resetOrUpdateCondition = function (condition, shouldUpdate) {
    if (shouldUpdate && condition.hasOwnProperty('_value')) {
        condition.value = condition._value;
    }

    delete condition._value;
    delete condition.fulfilledBy;
};

const splitNestedValues = ([...values]) => {
    const valuesList = [];
    values.some((value, i) => {
        if (value.constructor === Array) {
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

function forEach(map = [], iterator) {
    map.forEach(list => {
        list.forEach(iterator);
    });
}

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
    private updaterRegistry: { [key: string]: UpdaterMap } = {};
    private pUpdaterRegistry: { [key: string]: UpdaterMap } = {};
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
        const { name, _updaters: updaters } = epic;
        const error = new Error(name);
        invariant(!this.epicRegistry[name],
            error.throw(ErrorMessages.duplicateEpic));

        updaters.forEach(this._addUpdater.bind(this));
        this.epicRegistry[name] = epic;
        epic._stores.add(this);
    }

    unregister(epic: string | Epic) {
        const epicName = (epic as Epic).name || (epic as string);
        const epicObject = this.epicRegistry[epicName] as InternalEpic;

        if (epicObject) {
            delete this.epicRegistry[epicName];
            epicObject._stores.delete(this);
            epicObject._updaters.forEach(({ conditions }) => {
                conditions.forEach(({ type }: InternalCondition) => {
                    this.uRegistries.forEach(registry => {
                        registry[type] && registry[type].delete(epicName);
                    });
                });
            });
        }
    }

    _addUpdater(updater: Updater) {
        const { conditions, name, epic: epicName } = updater;
        const error = new Error(epicName, name);

        // validate conditions
        invariant(conditions.some((c: AnyCondition) => {
            if (isArray(c))
                invariant((c as AnyOfCondition).every((c1: Condition) => (
                    !c1.readonly && (c1.type || c1) !== '*'
                )), error.throw(ErrorMessages.invalidAnyOf));

            return !(c as Condition).readonly;
        }), error.throw(ErrorMessages.noReadonlyUpdaters));

        // register conditions
        updater.conditions = conditions.map((inputCondition: AnyCondition, i) => {
            return this._processUpdaterCondition(inputCondition, i, false,
                ({ type, isPattern }: InternalCondition) => {
                    let registry = this.updaterRegistry;
                    if (this.patternsEnabled && isPattern)
                        registry = this.pUpdaterRegistry;

                    let conditionMap = registry[type];
                    if (!conditionMap) registry[type] = conditionMap = new Map();
                    if (!conditionMap[epicName]) conditionMap[epicName] = [];
                    conditionMap[epicName].push([updater, i]);
                });
        });
    }

    _removeUpdater(updater: Updater) {
        const { conditions, name, epic: epicName } = updater;
        conditions.forEach(({ type }: InternalCondition) => {
            this.uRegistries.forEach(registry => {
                registry[type] &&
                    registry[type].set(epicName,
                        registry[type].get(epicName).filter(([u]) => updater !== u));
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
        if (!isAnyOf && !condition.isPattern && condition.readonly)
            condition.alwaysFulfilledWith =
                alwaysFulfilledWith.bind(condition, this.epicRegistry);

        callback.bind(this)(condition);
        return condition;
    }

    private _processStoreListeners(epicCache, sourceAction) {
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
                    const { type, isPattern } = condition;

                    if (this.patternsEnabled && isPattern) {
                        const regex = getRegexFromPattern(type);
                        updatedEpics.forEach(key => {
                            if (regex.test(key)) {
                                if (!condition.fulfilledBy)
                                    condition.fulfilledBy = {};

                                condition.fulfilledBy[key] = getSelectorValue(condition, {
                                    type: key,
                                    payload: epicCache[key]
                                });
                            }
                        });

                        hasChangedActive = Boolean(condition.fulfilledBy);
                    } else if (epicCache[type]) {
                        const payload = epicCache[type];
                        condition._value = getSelectorValue(condition, { type, payload });
                        hasChangedActive = didConditionChange(condition);
                    }
                });

                // If there are required conditions all of them should change
                if (hasChangedActive) {
                    const handlerParams = conditions.map((c: InternalCondition) =>
                        c.isPattern ? c.fulfilledBy :
                            c.hasOwnProperty('_value') ? c._value :
                                alwaysFulfilledWith.bind(c)()
                    );

                    try {
                        handler(handlerParams, { sourceAction });
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

        function processUpdater(updater, action, pattern?) {
            const [{ epic: epicName, conditions, handler }, conditionIndex] = updater;

            // If action target doesn't match the epicName return
            if (action.target && action.target !== epicName) return;
            const originalCondition = conditions[conditionIndex];

            let sendFullAction = Boolean(pattern);
            let activeCondition = originalCondition;
            if (isArray(activeCondition)) {
                sendFullAction = true;
                const conditionType = pattern || action.type;
                activeCondition = activeCondition.find(({ type }) => conditionType === type);
            }

            const conditionValue = getSelectorValue(activeCondition, action);
            // pattern conditions cannot have value as prev match and current match can be completely different epics
            if (!pattern) {
                conditionCache.push(activeCondition);
                activeCondition._value = conditionValue;
            }

            // Should always update the epic on pattern or external action
            // If this is an epic action, current epic should be updated only if value is changed
            if (pattern || external || didConditionChange(activeCondition)) {
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

            const handlerParams = conditions.map(c => {
                if (c.fulfilledBy)
                    return Object.values(c.fulfilledBy);
                else
                    return c.alwaysFulfilledWith();
            });

            const epic = this.epicRegistry[epicName];
            epic._state = epic.hasOwnProperty('_state') ? epic._state : epic.state;
            epic._scope = epic.hasOwnProperty('_scope') ? epic._scope : epic.scope;

            let stateUpdated = false;
            splitNestedValues(handlerParams).forEach(handlerParams => {
                const handlerUpdate = handler(handlerParams, sourceAction);
                const handleUpdate = (entity, callback = Function.prototype) => {
                    if (handlerUpdate.hasOwnProperty(entity)) {
                        let updatedValue, changes;
                        try {
                            [updatedValue, changes] =
                                merge(clone(epic['_' + entity]), handlerUpdate[entity], this.undoEnabled);
                        } catch (e) {
                            invariant(e !== MERGE_ERROR,
                                new Error(epicName, name).throw(ErrorMessages.invalidHandlerUpdate));
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

            if (stateUpdated) {
                const epicAction = new Action(epicName, epic._state);
                executeAction.bind(this)(epicAction, false);
            }
        }

        function executeAction(action, external) {
            if (external) {
                // throw if epic is triggered as an external action
                invariant(!this.epicRegistry[action.type],
                    new Error(action.type).throw(ErrorMessages.invalidEpicAction));

                // throw if repeated external action in same cycle
                invariant(!actionCache.hasOwnProperty(action.type),
                    new Error(action.type).throw(ErrorMessages.noRepeatedExternalAction));

                actionCache[action.type] = action.payload;
            }

            // handle direct updaters
            forEach(this.updaterRegistry[action.type], updater => {
                processUpdater.bind(this)(updater, action);
            });

            // handle pattern updaters
            if (this.patternsEnabled) {
                Object.keys(this.pUpdaterRegistry).forEach(key => {
                    if (getRegexFromPattern(key).test(action.type)) {
                        forEach(this.pUpdaterRegistry[key], updater => {
                            processUpdater.bind(this)(updater, action, key);
                        });
                    }
                });
            }
        }

        return function (action: string | Action) {
            // validate action
            action = processAction(action);

            // No actions should be dispatched from epic updaters
            invariant(!inCycle, ErrorMessages.noDispatchInEpicUpdater);

            // No actions should be dispatched from epic listeners
            invariant(!afterCycle, ErrorMessages.noDispatchInEpicListener);

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
                executeAction.bind(this)(action, true);
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
                this._processStoreListeners(epicCache, sourceAction);

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
                ({ type, isPattern }: InternalCondition) => {
                    let registry = this.storeListeners;
                    if (this.patternsEnabled && isPattern)
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
        const updaters = this._getEpic(epicName, '_updaters');
        const updater = updaters.find(({ name: n }) => name === n);
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
