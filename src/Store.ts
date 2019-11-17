import "core-js/es/symbol";

import memoize from 'memoizee';
import invariant from 'invariant';
import { error, makeError } from './errors';
import { INITIAL_VALUE, freeze, clone, merge, isEqual, MERGE_ERROR } from './object-utils';

const validateAction = action => freeze(typeof action === 'string' ? { type: action } : action);
const getSelectorValue = ({ selector }, { type, payload }) => selector(payload, type);
const getRegexFromPattern = pattern => new RegExp('^' + pattern.replace(/\*/g, '.*?') + '$');
const didConditionChange = condition => condition.hasOwnProperty('_value') && !isEqual(condition._value, condition.value);

function processCondition(currentError, condition, index) {
    if (condition.constructor === Array) {
        return condition.map(processCondition.bind(null, currentError));
    } else if (typeof condition === 'string') {
        condition = { type: condition };
    } else {
        condition = { ...condition };
    }

    const indexError = currentError(index);
    invariant(typeof condition.type === 'string', indexError('invalidConditionType'));

    const typeError = currentError(condition.type);
    if (condition.selector) {
        invariant(typeof condition.selector === 'function', typeError('invalidConditionSelector'));
        condition.selector = memoize(condition.selector, { max: 1 });
    } else {
        condition.selector = state => state;
    }

    if (!condition.hasOwnProperty('value')) {
        condition.value = INITIAL_VALUE;
    }

    return condition;
}

function splitConditions([...conditions]) {
    const conditionsList = [];
    conditions.some((condition, i) => {
        if (condition.constructor === Array) {
            condition.forEach(c => {
                conditions[i] = c;
                conditionsList.push(...splitConditions(conditions))
            });
            return true;
        }
        return false;
    });

    return conditionsList.length ? conditionsList : [conditions];
}

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

export const createStore = ({ debug = false, patterns = false, undo = false, maxUndoStack = 10 }) => {
    const store = {};
    const epicRegistry = {};

    const updaterRegistry = {};
    const patternRegistry = {};

    const epicListeners = {};
    const patternListeners = {};

    let undoStack = [];
    let redoStack = [];

    const UNDO_ACTION = { type: 'STORE_UNDO' };
    const REDO_ACTION = { type: 'STORE_REDO' };

    store.register = function ({ name, state = INITIAL_VALUE, scope = INITIAL_VALUE, updaters = [] }) {
        let currentError = makeError(name);
        invariant(!epicRegistry[name], error('duplicateEpic', name));

        epicRegistry[name] = {
            state: freeze(state === null ? INITIAL_VALUE : state),
            scope: freeze(scope === null ? INITIAL_VALUE : scope),
            updaters: updaters.map(({ conditions, handler }, index) => {
                currentError = currentError(index);
                conditions = conditions.map(processCondition.bind(null, currentError));
                return splitConditions(conditions).map(conditions => {
                    invariant(conditions.find(({ passive }) => !passive), currentError()('noPassiveUpdaters'));

                    const updater = { epic: name, handler, conditions, index };
                    conditions.forEach(({ type }) => {
                        let registry = updaterRegistry;
                        if (patterns && /\*/.test(type))
                            registry = patternRegistry;

                        if (!registry[type]) registry[type] = [];
                        registry[type].push(updater);
                    });

                    return updater;
                });
            })
        };
    };

    store.unregister = function (epic) {
        const epicName = epic.name || epic;
        if (epicRegistry[epicName]) {
            delete epicRegistry[epicName];
            [updaterRegistry, patternRegistry].forEach(registry => {
                Object.keys(registry).forEach(condition => {
                    registry[condition] = registry[condition].filter(({ epic }) => epic !== epicName);
                });
            });
        }
    };

    const getHandlerParams = conditions => conditions.map(condition => {
        let value = condition.hasOwnProperty('_value') ? condition._value : condition.value;
        if (value === INITIAL_VALUE) {
            const epic = epicRegistry[condition.type];
            if (epic) {
                value = condition._value = getSelectorValue(condition, epic.state);
            }
        }
        return value === INITIAL_VALUE ? undefined : value;
    });

    const processEpicListeners = (epicCache, sourceAction) => {
        const epicListenerCache = [];
        const postProcessingErrors = [];
        const updatedEpics = Object.keys(epicCache);
        updatedEpics.forEach(epicName => {
            const listeners = epicListeners[epicName] || [];
            if (patterns) {
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
                    if (patterns && /\*/.test(type)) {
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

        const processUpdater = function (activeCondition, updater, forcePassiveUpdate) {
            const { epic: epicName, conditions, handler, index } = updater;

            // If this is passive action
            // there should be atleast one non passive condition whose value changed
            // if not dont update the epic
            if (activeCondition.passive && !conditions.some(condition => (
                !condition.passive && (condition.matchedPattern || didConditionChange(condition))
            ))) return;

            // if all active conditions are not changed, dont update the epic
            // PS: activeCondition doesnt need to change if it is external
            if (!conditions.every(condition => (
                condition === activeCondition ||
                condition.passive || !condition.required ||
                condition.matchedPattern || didConditionChange(condition)
            ))) return;

            const epic = epicRegistry[epicName];
            epic._state = epic.hasOwnProperty('_state') ? epic._state : epic.state;
            epic._scope = epic.hasOwnProperty('_scope') ? epic._scope : epic.scope;

            const handlerUpdate = handler(getHandlerParams(conditions), {
                state: epic.state, currentCycleState: epic._state,
                scope: epic.scope, currentCycleScope: epic._scope,
                sourceAction
            });

            const handleUpdate = (entity, callback = Function.prototype) => {
                if (handlerUpdate.hasOwnProperty(entity)) {
                    let updatedValue, changes;
                    try {
                        [updatedValue, changes] =
                            merge(clone(epic['_' + entity]), handlerUpdate[entity], undo);
                    } catch (e) {
                        invariant(e !== MERGE_ERROR,
                            error('invalidHandlerUpdate', epicName, index));
                        throw e;
                    }

                    epic['_' + entity] = freeze(updatedValue);
                    if (undo) {
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
                    processAction({ type: epicName, payload: epic._state }, false);
                }
            });

            if (handlerUpdate.hasOwnProperty('actions')) {
                handlerUpdate.actions.forEach(
                    action => processAction(validateAction(action), true));
            }
        };

        const processAction = (action, external) => {
            invariant(!external || !epicRegistry[action.type], error('invalidEpicAction', action.type));
            invariant(!external || !actionCache.hasOwnProperty(action.type), error('noRepeatedExternalAction', action.type));
            external && (actionCache[action.type] = action.payload);

            // handle direct updaters
            (updaterRegistry[action.type] || []).forEach(function ({ epic: epicName, conditions }) {
                const activeCondition = conditions.find(({ type }) => action.type === type);
                if (!action.target || epicName === action.target) {
                    activeCondition._value = getSelectorValue(activeCondition, action);
                    conditionCache.push(activeCondition);

                    // If this is not external action and condition value didnt change, dont update the epic
                    if (!external && !didConditionChange(activeCondition)) return;
                    processUpdater(activeCondition, arguments[0]);
                }
            });

            // handle pattern updaters
            if (patterns) {
                Object.keys(patternRegistry).forEach(key => {
                    const regex = getRegexFromPattern(key);
                    if (regex.test(action.type)) {
                        patternRegistry[key].forEach(function ({ epic: epicName, conditions }) {
                            const activeCondition = conditions.find(({ type }) => key === type);
                            if (!action.target || epicName === action.target) {
                                activeCondition.matchedPattern = true;
                                conditionCache.push(activeCondition);

                                processUpdater(activeCondition, arguments[0], key === '*');
                            }
                        });
                    }
                });
            }
        };

        return function (action) {
            // validate action
            action = validateAction(action);

            // Handle external actions during cycle
            if (inCycle) return processAction(action, true);
            // No actions should be dispatched from epic listeners
            invariant(!afterCycle, error('noDispatchInEpicListener'));

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
                processAction(action, true);
            } catch (e) {
                processingError = e;
            }

            // End of dispatch cycle
            inCycle = false;
            afterCycle = true;

            // handle epic listeners
            let postProcessingErrors = [];
            if (!processingError) {
                postProcessingErrors = processEpicListeners(epicCache, sourceAction);
            }

            // Update or reset conditions
            conditionCache.forEach(condition => {
                resetOrUpdateCondition(condition, !processingError);
            });

            // Update or reset epics
            Object.keys(epicCache).forEach(epicName => {
                resetOrUpdateEpic(epicRegistry[epicName], !processingError);
            });

            if (undo && !processingError) {
                if (undoStack.length === maxUndoStack)
                    undoStack.shift();

                undoStack.push(undoEntry);
                redoStack = [];
            }

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
            if (patterns && /\*/.test(type)) listeners = patternListeners;

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
