import memoize from 'memoizee';
import invariant from 'invariant';
import { error, makeError } from './Errors';
import { initialValue, freeze, unfreeze } from './Frozen';

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
        condition.value = initialValue;
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

const validateAction = action => freeze(typeof action === 'string' ? { type: action } : action);

const getSelectorValue = ({ selector }, { type, payload }) => selector(payload, type);

const didConditionChange = condition => condition.hasOwnProperty('_value') && (condition._value !== condition.value);

const getHandlerParams = conditions => conditions.map(condition => {
    const value = condition.hasOwnProperty('_value') ? condition._value : condition.value;
    return value === initialValue ? undefined : value;
});

const getRegexFromPattern = pattern => new RegExp('^' + pattern.replace(/\*/g, '.*?') + '$');

export const createStore = ({ debug = false, patterns = false }) => {
    const store = {};
    const epicRegistry = {};

    const updaterRegistry = {};
    const patternRegistry = {};

    const epicListeners = {};
    const patternListeners = {};

    store.register = function ({ name, state = initialValue, scope = initialValue, updaters = [] }) {
        let currentError = makeError(name);
        invariant(!epicRegistry[name], error('duplicateEpic', name));

        epicRegistry[name] = {
            state: freeze(state),
            scope: freeze(scope),
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

    store.dispatch = (() => {
        let sourceAction, actionCache, conditionCache, inCycle, afterCycle, epicListenerCache;

        const processUpdater = function (action, activeCondition, updater, forcePassiveUpdate) {
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
                sourceAction, currentAction: action
            });

            if (handlerUpdate.hasOwnProperty('scope')) {
                epic._scope = freeze(unfreeze(epic._scope, handlerUpdate.scope, error('invalidHandlerUpdate', epicName, index)));
            }

            if (handlerUpdate.hasOwnProperty('state')) {
                epic._state = freeze(unfreeze(epic._state, handlerUpdate.state, error('invalidHandlerUpdate', epicName, index)));
                if (!forcePassiveUpdate && !handlerUpdate.passiveUpdate) {
                    processAction({ type: epicName, payload: epic._state });
                } else {
                    actionCache[epicName] = epic._state;
                }
            }

            if (handlerUpdate.hasOwnProperty('actions')) {
                handlerUpdate.actions.forEach(action => processAction(validateAction(action), true));
            }
        };

        const processAction = (action, external) => {
            invariant(!external || !epicRegistry[action.type], error('invalidEpicAction', action.type));
            invariant(!external || !actionCache.hasOwnProperty(action.type), error('noRepeatedExternalAction', action.type));
            actionCache[action.type] = action.payload;
            (updaterRegistry[action.type] || []).forEach(function ({ conditions }) {
                const activeCondition = conditions.find(({ type }) => action.type === type);
                activeCondition._value = getSelectorValue(activeCondition, action);
                conditionCache.push(activeCondition);

                // If this is not external action and condition value didnt change, dont update the epic
                if (!external && !didConditionChange(activeCondition)) return;

                processUpdater(action, activeCondition, arguments[0]);
            });

            // handle patterns
            if (patterns) {
                Object.keys(patternRegistry).forEach(key => {
                    const regex = getRegexFromPattern(key);
                    if (regex.test(action.type)) {
                        patternRegistry[key].forEach(function ({ conditions }) {
                            const activeCondition = conditions.find(({ type }) => key === type);
                            activeCondition.matchedPattern = true;
                            conditionCache.push(activeCondition);
                            processUpdater(action, activeCondition, arguments[0], key === '*');
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
            actionCache = {};
            conditionCache = [];
            sourceAction = action;
            epicListenerCache = [];

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

            const postProcessingErrors = [];
            const currentActionQueue = Object.keys(actionCache);
            currentActionQueue.forEach(actionType => {
                if (!processingError) {
                    const listeners = epicListeners[actionType] || [];
                    if (patterns) {
                        Object.keys(patternListeners).forEach(key => {
                            if (getRegexFromPattern(key).test(actionType)) {
                                listeners.push(...patternListeners[key]);
                            }
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
                            if (patterns && /\*/.test(condition.type)) {
                                const regex = getRegexFromPattern(condition.type);
                                if (currentActionQueue.some(key => regex.test(key))) {
                                    if (condition.required) {
                                        hasRequired = true;
                                    } else if (!condition.passive) {
                                        hasChangedActive = true;
                                    }
                                } else if (condition.required) {
                                    hasRequired = true;
                                    hasUnchangedRequired = true;
                                }
                            } else if (actionCache[condition.type]) {
                                condition._value = getSelectorValue(condition, {
                                    type: condition.type,
                                    payload: actionCache[condition.type]
                                });

                                if (condition.required) {
                                    hasRequired = true;
                                    if (!didConditionChange(condition)) {
                                        hasUnchangedRequired = true;
                                    }
                                } else if (!condition.passive && didConditionChange(condition)) {
                                    hasChangedActive = true;
                                }
                            } else if (condition.required) {
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
                }

                const epic = epicRegistry[actionType];
                if (epic) {
                    if (!processingError) {
                        epic.state = epic._state;
                        epic.scope = epic._scope;
                    }
                    delete epic._state;
                    delete epic._scope;
                }
            });

            epicListenerCache.forEach(listener => {
                listener.conditions.forEach(condition => {
                    if (condition.hasOwnProperty('_value')) {
                        condition.value = condition._value;
                    }
                    delete condition._value;
                });
                delete listener.processed;
            });

            conditionCache.forEach(condition => {
                if (!processingError && condition.hasOwnProperty('_value')) {
                    condition.value = condition._value;
                }
                delete condition._value;
                delete condition.matchedPattern;
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
            if (patterns && /\*/.test(type)) listeners = patternListeners;

            if (!listeners[type]) listeners[type] = [];
            listeners[type].push(epicListener) - 1;

            return { listeners, type };
        });

        return () => {
            cache.forEach(({ listeners, type }) => {
                listeners[type] = listeners[type].filter(listener => listener !== epicListener);
            });
        };
    };

    if (debug) {
        const getEpic = function (epicName, key) {
            const epic = epicRegistry[epicName];
            return epic ? epic[key] : null;
        };

        store.getEpicState = function (epicName) {
            return getEpic(epicName, 'state');
        };

        store.getEpicScope = function (epicName) {
            return getEpic(epicName, 'scope');
        };

        store.getEpicUpdaters = function (epicName, index) {
            return getEpic(epicName, 'updaters')[index].map(({ conditions }) => ({
                conditions: conditions.map(condition => ({ ...condition }))
            }));
        };

        store.getEpicListeners = function (conditionType) {
            return [...epicListeners[conditionType].map(({ conditions }) => ({
                conditions: conditions.map(condition => ({ ...condition }))
            }))];
        };
    }

    return store;
};
