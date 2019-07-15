import memoize from 'memoizee';
import invariant from 'invariant';
import { error, makeError } from './Errors';
import { initialValue, freeze, unfreeze } from './Frozen';

const epicRegistry = {};
const updaterRegistry = {};
const epicListeners = {};

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
    invariant(!condition.passive || !condition.optional, typeError('invalidConditionOP'));

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

const register = function({ name, state = initialValue, scope = initialValue, updaters = [] }) {
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
                    if (!updaterRegistry[type]) updaterRegistry[type] = [];
                    updaterRegistry[type].push(updater);
                });

                return updater;
            });
        })
    };
};

const unregister = function(epic) {
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

const dispatch = (() => {
    let sourceAction, actionCache, conditionCache, inCycle, afterCycle, epicListenerCache;

    const validateAction = action => {
        if (typeof action === 'string') action = { type: action };
        return freeze(action);
    };

    const getHandlerParams = conditions => conditions.map(condition => {
        const value = condition.hasOwnProperty('_value') ? condition._value : condition.value;
        return value === initialValue ? undefined : value;
    });

    const processAction = (action, external) => {
        invariant(!external || !epicRegistry[action.type], error('invalidEpicAction', action.type));
        invariant(!external || !actionCache.hasOwnProperty(action.type), error('noRepeatedExternalAction', action.type));
        actionCache[action.type] = action.payload;
        (updaterRegistry[action.type] || []).forEach(({ epic: epicName, conditions, handler, index }) => {
            const activeCondition = conditions.find(({ type }) => action.type === type);
            activeCondition._value = getSelectorValue(activeCondition, action);
            conditionCache.push(activeCondition);

            // If this is not external action and condition value didnt change, dont update the epic
            if (!external && !didConditionChange(activeCondition)) return;

            // If this is passive action
            // there should be atleast one non passive condition whose value changed
            // if not dont update the epic
            if (activeCondition.passive && !conditions.some(condition => (
                !condition.passive && didConditionChange(condition)
            ))) return;

            // if all active conditions are not changed, dont update the epic
            // PS: activeCondition doesnt need to change if it is external
            if (!conditions.every(condition => (
                condition === activeCondition ||
                condition.optional || condition.passive ||
                didConditionChange(condition)
            ))) return;

            const epic = epicRegistry[epicName];
            epic._state = epic.hasOwnProperty('_state') ? epic._state : epic.state;
            epic._scope = epic.hasOwnProperty('_scope') ? epic._scope : epic.scope;

            const handlerUpdate = handler(getHandlerParams(conditions), {
                state: epic._state, prevState: epic.state,
                scope: epic._scope, prevScope: epic.scope,
                sourceAction, currentAction: action
            });

            if (handlerUpdate.hasOwnProperty('scope')) {
                epic._scope = freeze(unfreeze(epic._scope, handlerUpdate.scope, error('invalidHandlerUpdate', epicName, index)));
            }

            if (handlerUpdate.hasOwnProperty('state')) {
                epic._state = freeze(unfreeze(epic._state, handlerUpdate.state, error('invalidHandlerUpdate', epicName, index)));
                processAction({ type: epicName, payload: epic._state });
            }

            if (handlerUpdate.hasOwnProperty('actions')) {
                handlerUpdate.actions.forEach(action => processAction(validateAction(action), true));
            }
        });
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

                    const { conditions, handler } = listener;
                    conditions.forEach(condition => {
                        if (actionCache[condition.type]) {
                            condition._value = getSelectorValue(condition, {
                                type: condition.type,
                                payload: actionCache[condition.type]
                            });
                        }
                    });

                    // If all conditions are optional or passive
                    // then atleast one optional condition should change
                    // Else all active conditions should change
                    if (
                        conditions.every(({ optional, passive }) => (optional || passive)) ?
                            conditions.some(condition => condition.optional && didConditionChange(condition)) :
                            conditions.every(condition => (
                                condition.optional || condition.passive || didConditionChange(condition)
                            ))
                    ) {
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

const addListener = function (conditions, handler) {
    conditions = conditions.map(processCondition.bind(null, makeError()()));
    const epicListener = { conditions, handler };

    const indices = conditions.map(({ type }) => {
        if (!epicListeners[type]) epicListeners[type] = [];
        return epicListeners[type].push(epicListener) - 1;
    });

    return function removeListener() {
        conditions.forEach(({ type }, index) => {
            epicListeners[type].splice(indices[index], 1);
        });
    };
};

const anyOf = function (...conditions) {
    return conditions;
};

const getEpic = function(epicName, key) {
    const epic = epicRegistry[epicName];
    return epic ? epic[key] : null;
};

const getEpicState = function(epicName) {
    return getEpic(epicName, 'state');
};

const getEpicScope = function(epicName) {
    return getEpic(epicName, 'scope');
};

const getEpicUpdaters = function (epicName, index) {
    return getEpic(epicName, 'updaters')[index].map(({ conditions }) => ({
        conditions: conditions.map(condition => ({ ...condition }))
    }));
};

export default {
    register,
    unregister,
    dispatch,
    addListener,
    anyOf,
    getEpicState,
    getEpicScope,
    getEpicUpdaters,
};
