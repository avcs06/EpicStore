import memoize from 'memoizee';
import invariant from 'invariant';
import Errors from './Errors';
import { freeze, unfreeze } from './Utilities';

const epicRegistry = {};
const updaterRegistry = {};
const epicListeners = {};
const initialConditionValue = Symbol('initialConditionValue');

function processCondition(condition) {
    if (condition.constructor === Array) {
        return condition.map(processCondition);
    } else if (typeof condition === 'string') {
        condition = { type: condition };
    } else {
        condition = { ...condition };
    }

    invariant(typeof condition.type === 'string', Errors.invalidConditionType);

    if (condition.selector) {
        invariant(typeof condition.selector === 'function', Errors.invalidConditionSelector);
        condition.selector = memoize(condition.selector, { max: 1 });
    } else {
        condition.selector = state => state;
    }

    condition.value = condition.value || initialConditionValue;
    return condition;
}

function splitConditions([...conditions]) {
    const conditionsList = [];
    conditions.forEach((condition, i) => {
        if (condition.constructor === Array) {
            condition.forEach(c => {
                conditions[i] = c;
                conditionsList.push(...splitConditions(conditions))
            });
        }
    });

    return conditionsList.length ? conditionsList : [conditions];
}

export const register = function({ name, state = {}, scope = {}, updaters = [] }) {
    invariant(!epicRegistry[name], Errors.duplicateEpic);
    invariant(state !== null && typeof state === 'object', Errors.invalidEpicState);
    invariant(scope !== null && typeof scope === 'object', Errors.invalidEpicScope);

    epicRegistry[name] = { state: freeze(state), scope: freeze(scope) };
    updaters.forEach(({ conditions, handler }, index) => {
        conditions = conditions.map(processCondition);
        splitConditions(conditions).forEach(conditions => {
            invariant(conditions.find(({ passive }) => !passive), Errors.noPassiveUpdaters);

            const updater = { epic: name, handler, conditions };
            conditions.forEach(({ type }) => {
                if (!updaterRegistry[type]) updaterRegistry[type] = [];
                updaterRegistry[type].push(updater);
            });
        });
    });
};

export const unregister = function(epic) {
    const epicName = epic.name || epic;
    if (epicRegistry[epicName]) {
        delete epicRegistry[epicName];
        Object.keys(updaterRegistry).forEach(condition => {
            updaterRegistry[condition] = updaterRegistry[condition].filter(({ epic }) => epic !== epicName);
        });
    }
};

const getSelectorValue = ({ selector }, { type, payload }) => selector(payload, type);
const didConditionChange = condition => condition.hasOwnProperty('_value') && (condition._value !== condition.value);

export const dispatch = (() => {
    let sourceAction, actionCache, conditionCache, inCycle, afterCycle, epicListenerCache;

    const getHandlerParams = conditions => conditions.map(condition => (
        condition.hasOwnProperty('_value') ? condition._value : condition.value
    ));

    const processAction = (action, external) => {
        actionCache[action.type] = action.payload;
        (updaterRegistry[action.type] || []).forEach(({ epic: epicName, conditions, handler }) => {
            const activeCondition = conditions.find(({ type }) => action.type === type);
            activeCondition._value = getSelectorValue(activeCondition, action);
            conditionCache.push(activeCondition);

            if (!external && !didConditionChange(activeCondition)) return;

            if (activeCondition.passive && !conditions.some(condition => (
                !condition.passive && didConditionChange(condition)
            ))) return;

            if (!conditions.every(condition => (
                condition === activeCondition ||
                (condition.optional || condition.passive) &&
                condition.value !== initialConditionValue ||
                didConditionChange(condition)
            ))) return;

            const epic = epicRegistry[epicName];
            epic._state = epic._state || epic.state;
            epic._scope = epic._scope || epic.scope;

            const { state, scope, actions } = handler(getHandlerParams(conditions), {
                state: epic._state, prevState: epic.state,
                scope: epic._scope, prevScope: epic.scope,
                sourceAction, currentAction: action
            });

            if (scope) {
                epic._scope = freeze({ ...unfreeze(epic._scope), ...scope });
            }

            if (state) {
                epic._state = freeze({ ...unfreeze(epic._state), ...state });
                processAction(freeze({ type: epicName, payload: epic._state }));
            }

            if (actions) {
                actions.forEach(action => processAction(freeze(action)));
            }
        });
    };

    return function (action) {
        // validate action
        if (typeof action === 'string') action = { type: action };
        action = freeze(action);

        // Handle external actions during cycle
        if (inCycle) return processAction(action, true);
        invariant(!afterCycle, Errors.noDispatchInEpicListener);

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
        } catch(e) {
            processingError = e;
        }

        // End of dispatch cycle
        inCycle = false;
        afterCycle = true;

        const postProcessingErrors = [];
        Object.keys(actionCache).forEach(actionType => {
            if (!processingError) {
                const listeners = epicListeners[actionType] || [];
                listeners.forEach(listener => {
                    if (listener.processed) return;

                    let hasChange = false;
                    const { conditions, handler } = listener;
                    conditions.forEach(condition => {
                        if (actionCache[condition.type]) {
                            condition._value = getSelectorValue(condition, actionCache[condition.type]);
                            if (!hasChange && condition._value !== condition.value) {
                                hasChange = true;
                            }
                        }
                    });

                    if (hasChange) {
                        try {
                            listener.processed = true;
                            handler(getHandlerParams(conditions), { sourceAction });
                        } catch(e) {
                            listener.hasError = true;
                            postProcessingErrors.push(e);
                        }
                        epicListenerCache.push(listener);
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
                if (!listener.hasError) {
                    condition.value = condition._value;
                }
                delete condition._value;
            });
            delete listener.hasError;
            delete listener.processed;
        });

        conditionCache.forEach(condition => {
            if (!processingError) {
                condition.value = condition._value;
            }
            delete condition._value;
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

export const addListener = function (conditions, handler) {
    conditions = conditions.map(processCondition);
    const epicListener = { conditions, handler };

    conditions.forEach(({ type }) => {
        if (!epicListeners[type]) epicListeners[type] = [];
        epicListeners[type].push(epicListener);
    });

    return function removeListener() {
        conditions.forEach(({ type }) => {
            epicListeners[type] =
                epicListeners[type].filter(listener =>  listener !== epicListener);
        });
    };
};

export const anyOf = function (...conditions) {
    return conditions;
};

export const getEpicState = function(epicName) {
    if (epicRegistry[epicName]) {
        return epicRegistry[epicName].state;
    }

    return (
        Object.keys(epicRegistry)
            .reduce((a, c) => {
                a[c] = epicRegistry[c].state;
                return a;
            }, {})
    );
};

export default {
    register,
    unregister,
    dispatch,
    addListener,
    anyOf,
    getEpicState
};
