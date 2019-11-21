import memoize from 'memoizee';
import invariant from 'invariant';
import { Error, ErrorMessages } from './Error';
import { INITIAL_VALUE, MERGE_ERROR, freeze, clone, merge, isEqual, isArray } from './object';

import { Epic, Updater } from './Epic';
import { getConditionFrom, AnyOfCondition, Condition, anyOf, SingletonInputCondition } from './Condition';
import { Action, getActionFrom } from './Action';

const processAction = action => {
    action = getActionFrom(action);
    const { target } = action;
    if (target)
        action.target = typeof target === 'string' ? target : target.name;
    return action;
}

const processCondition = (condition): Condition => {
    condition = getConditionFrom(condition);

    if (condition.selector)
        condition.selector = memoize(condition.selector, { max: 1 });

    condition.value = INITIAL_VALUE;
    return condition;
}

const getSelectorValue = ({ selector }, { type, payload }) =>
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
    delete condition.matchedPattern;
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

const UNDO_ACTION = { type: 'STORE_UNDO' };
const REDO_ACTION = { type: 'STORE_REDO' };

interface UndoParams {
    maxStack: number
}

interface StoreParams {
    debug?: boolean;
    patterns?: boolean;
    undo?: boolean | UndoParams
}

export const createStore = ({ debug, patterns, undo }: StoreParams = {}) => {
    const undoEnabled = Boolean(undo);
    const debugEnabled = Boolean(debug);
    const patternsEnabled = Boolean(patterns);
    const undoMaxStack = (undo as UndoParams)?.maxStack || 10

    const store: any = {};
    const epicRegistry = {};

    const updaterRegistry = {};
    const patternRegistry = {};

    const epicListeners = {};
    const patternListeners = {};

    let undoStack = [];
    let redoStack = [];

    function alwaysFulfilledWith() {
        if (this.value === INITIAL_VALUE && epicRegistry[this.type])
            return getSelectorValue(this, {
                type: this.type,
                payload: epicRegistry[this.type].state
            });

        return this.value === INITIAL_VALUE ? undefined : this.value;
    }

    store.register = function register(epic: Epic) {
        const { name, updaters } = epic;
        const error = new Error(name);

        invariant(!epicRegistry[name],
            error.throw(ErrorMessages.duplicateEpic));

        updaters.forEach(updater => {
            const { conditions, name } = updater;
            error.updater = name;
            (epic as any)._conditions = {};

            invariant(conditions.some((c: any) => !c.passive),
                error.throw(ErrorMessages.noPassiveUpdaters));

            updater.conditions = conditions.map(
                (function eachCondition(isAnyOf, condition, i) {
                    if (isArray(condition)) {
                        return (condition as AnyOfCondition).map(condition => {
                            return eachCondition(true, condition, i);
                        }) as AnyOfCondition;
                    }

                    condition = processCondition(condition);
                    const { type } = condition as Condition;

                    let registry = updaterRegistry;
                    if (patternsEnabled && /\*/.test(type)) {
                        registry = patternRegistry;
                        condition.isPattern = true;
                    }

                    if (!registry[type])
                        registry[type] = [];

                    (epic as any)._conditions[type] = true;
                    registry[type].push([updater, i]);

                    if (!isAnyOf && !condition.isPattern && (condition.passive || !condition.required))
                        condition.alwaysFulfilledWith = alwaysFulfilledWith;

                    return condition;
                }).bind(null, false)
            );
        });

        (epic as any)._conditions = Object.keys((epic as any)._conditions);
        epicRegistry[name] = epic;
    };

    store.unregister = function unregister(epic: string | Epic) {
        const epicName = (epic as Epic).name || (epic as string);
        const epicObject = this.epicRegistry[epicName];

        if (epicObject) {
            delete this.epicRegistry[epicName];
            [this.updaterRegistry, this.patternRegistry].forEach(registry => {
                epicObject._conditions.forEach(condition => {
                    registry[condition] &&
                        (registry[condition] =
                            registry[condition].filter(({ epic }) => epic !== epicName));
                });
            });
        }
    };

    const processEpicListeners = (epicCache, sourceAction) => {
        const epicListenerCache = [];
        const postProcessingErrors = [];
        const updatedEpics = Object.keys(epicCache);
        updatedEpics.forEach(epicName => {
            const listeners = epicListeners[epicName] || [];
            if (patternsEnabled) {
                Object.keys(patternListeners).forEach(key => {
                    if (getRegexFromPattern(key).test(epicName))
                        listeners.push(...patternListeners[key]);
                });
            }

            listeners.forEach(listener => {
                if (listener.processed) return;
                listener.processed = true;
                epicListenerCache.push(listener);

                let hasRequired = false;
                let hasChangedActive = false;
                let hasUnchangedRequired = false;
                const { conditions, handler } = listener;

                conditions.forEach(condition => {
                    const { type, passive, required } = condition;
                    if (patternsEnabled && /\*/.test(type)) {
                        const regex = getRegexFromPattern(type);
                        if (updatedEpics.some(key => regex.test(key))) {
                            if (required) {
                                hasRequired = true;
                            } else if (!passive) {
                                hasChangedActive = true;
                            }
                        } else if (required) {
                            hasRequired = true;
                            hasUnchangedRequired = true;
                        }
                    } else if (epicCache[type]) {
                        const payload = epicCache[type];
                        condition._value = getSelectorValue(condition, { type, payload });

                        if (required) {
                            hasRequired = true;
                            if (!didConditionChange(condition)) {
                                hasUnchangedRequired = true;
                            }
                        } else if (!passive && didConditionChange(condition)) {
                            hasChangedActive = true;
                        }
                    } else if (required) {
                        hasRequired = true;
                        hasUnchangedRequired = true;
                    }
                });

                // If there are required conditions all of them should change,
                // else at least one active condition should change
                if (hasRequired ? !hasUnchangedRequired : hasChangedActive) {
                    try {
                        handler(getHandlerParams(conditions), { sourceAction });
                    } catch (e) {
                        postProcessingErrors.push(e);
                    }
                }
            });
        });

        epicListenerCache.forEach(listener => {
            listener.conditions.forEach(resetOrUpdateCondition.bind(null, true));
            delete listener.processed;
        });

        return postProcessingErrors;
    };

    store.dispatch = (() => {
        let sourceAction, epicCache, actionCache, conditionCache, inCycle, afterCycle, undoEntry;

        const processUpdater = function (updater, action, pattern?) {
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

            conditionCache.push(activeCondition);
            const conditionValue = getSelectorValue(activeCondition, action);

            // pattern conditions cannot have value as prev match and current match can be completely different epics
            if (!pattern)
                activeCondition._value = conditionValue;

            // Should always update the epic on pattern or external action
            // If this is an epic action, current epic should be updated only if value is changed
            if (pattern || external || didConditionChange(activeCondition)) {
                if (!originalCondition.fulfilledBy)
                    originalCondition.fulfilledBy = {};

                originalCondition.fulfilledBy[action.type] =
                    sendFullAction ? {
                        type: action.type,
                        payload: conditionValue
                    } : conditionValue;
            } else return;

            // If this is passive condition, there should be atleast one non passive fulfilled condition
            if (activeCondition.passive &&
                !conditions.some(c => !c.passive && c.fulfilledBy)) return;

            // All conditions should either be always fulfilled or fulfilled in the cycle
            if (!conditions.every(condition => 
                condition.fulfilledBy || condition.alwaysFulfilledWith)) return;

            const handlerParams = conditions.map(c => {
                if (c.fulfilledBy)
                    return Object.values(c.fulfilledBy);
                else
                    return c.alwaysFulfilledWith();
            });

            const epic = epicRegistry[epicName];
            epic._state = epic.hasOwnProperty('_state') ? epic._state : epic.state;
            epic._scope = epic.hasOwnProperty('_scope') ? epic._scope : epic.scope;

            splitNestedValues(handlerParams).forEach(handlerParams => {
                const handlerUpdate = handler(handlerParams, sourceAction);
                const handleUpdate = (entity, callback = Function.prototype) => {
                    if (handlerUpdate.hasOwnProperty(entity)) {
                        let updatedValue, changes;
                        try {
                            [updatedValue, changes] =
                                merge(clone(epic['_' + entity]), handlerUpdate[entity], undoEnabled);
                        } catch (e) {
                            invariant(e !== MERGE_ERROR,
                                new Error(epicName, name).throw(ErrorMessages.invalidHandlerUpdate));
                            throw e;
                        }

                        epic['_' + entity] = freeze(updatedValue);
                        if (undoEnabled) {
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
                    if (!forcePassiveUpdate && !handlerUpdate.passive) {
                        executeAction({ type: epicName, payload: epic._state }, false);
                    }
                });

                if (handlerUpdate.hasOwnProperty('actions')) {
                    handlerUpdate.actions.forEach(
                        action => executeAction(processAction(action), true));
                }
            });
        };

        const executeAction = (action, external) => {
            if (external) {
                // throw if epic is triggered as an external action
                invariant(!epicRegistry[action.type],
                    new Error(action.type).throw(ErrorMessages.invalidEpicAction));

                // throw if repeated external action in same cycle
                invariant(!actionCache.hasOwnProperty(action.type),
                    new Error(action.type).throw(ErrorMessages.noRepeatedExternalAction));

                actionCache[action.type] = action.payload;
            }

            // handle direct updaters
            (updaterRegistry[action.type] || []).forEach(updater => {
                processUpdater(updater, action);
            });

            // handle pattern updaters
            if (patternsEnabled) {
                Object.keys(patternRegistry).forEach(key => {
                    if (getRegexFromPattern(key).test(action.type)) {
                        patternRegistry[key].forEach(function (updater) {
                            processUpdater(updater, action, key);
                        });
                    }
                });
            }
        };

        return function (action: string | Action) {
            // validate action
            action = processAction(action);

            // Handle external actions during cycle
            if (inCycle)
                return executeAction(action, true);

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
                executeAction(action, true);
            } catch (e) {
                processingError = e;
            }

            // End of dispatch cycle
            inCycle = false;
            afterCycle = true;

            let postProcessingErrors = [];
            const isSuccessfulCycle = !processingError;

            if (isSuccessfulCycle) {
                // handle epic listeners
                postProcessingErrors = processEpicListeners(epicCache, sourceAction);

                // update undo entry
                if (undoEnabled && (action as Action).createUndoPoint) {
                    if (undoStack.length === undoMaxStack)
                        undoStack.shift();

                    undoStack.push(undoEntry);
                    redoStack = [];
                }
            }

            // Update or reset conditions
            conditionCache.forEach(condition => {
                resetOrUpdateCondition(condition, isSuccessfulCycle);
            });

            // Update or reset epics
            Object.keys(epicCache).forEach(epicName => {
                resetOrUpdateEpic(epicRegistry[epicName], isSuccessfulCycle);
            });

            afterCycle = false;

            // After everything is reset throw the caught errors
            if (processingError) {
                throw processingError;
            }
            if (postProcessingErrors.length) {
                throw postProcessingErrors;
            }
        };
    })();

    store.addListener = function (conditions, handler) {
        conditions = conditions.map(processCondition.bind(null, makeError()()));
        const epicListener = { conditions, handler };
        const cache = conditions.map(({ type }) => {
            let listeners = epicListeners;
            if (patternsEnabled && /\*/.test(type)) listeners = patternListeners;

            if (!listeners[type]) listeners[type] = [];
            listeners[type].push(epicListener);

            return { listeners, type };
        });

        return () => {
            cache.forEach(({ listeners, type }) => {
                listeners[type] =
                    listeners[type].filter(listener => listener !== epicListener);
            });
        };
    };

    if (undo) {
        const handleChange = function (from, to, key) {
            const entry = from.pop();
            const epicCache = {};
            if (!entry) return epicCache;

            Object.keys(entry).forEach(epicName => {
                const epic = epicRegistry[epicName];
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
        };

        store.undo = function () {
            const epicCache = handleChange(undoStack, redoStack, 'undo');
            processEpicListeners(epicCache, UNDO_ACTION);
        };

        store.redo = function () {
            const epicCache = handleChange(redoStack, undoStack, 'redo');
            processEpicListeners(epicCache, REDO_ACTION);
        };
    }

    const getEpic = function (epicName, key) {
        const epic = epicRegistry[epicName];
        return epic ? epic[key] : null;
    };

    store.getEpicState = function (epicName) {
        return getEpic(epicName, 'state');
    };

    if (debug) {
        store.getEpicScope = function (epicName) {
            return getEpic(epicName, 'scope');
        };

        store.getEpicUpdaters = function (epicName, index) {
            return getEpic(epicName, 'updaters')[index].map(({ conditions }) => ({
                conditions: conditions.map(condition => ({ ...condition }))
            }));
        };

        store.getEpicListeners = function (conditionType) {
            return epicListeners[conditionType].map(({ conditions }) => ({
                conditions: conditions.map(condition => ({ ...condition }))
            }));
        };
    }

    return store;
};
