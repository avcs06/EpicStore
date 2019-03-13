import memoize from 'memoizee';

const epics = {};
const updaters = {};
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

    if (!condition.type || condition.type !== 'string') {
        throw new Error('Missing required property: condition.type');
    }

    if (condition.selector) {
        if (typeof condition.selector !== 'function') {
            throw new Error('Invalid Type: condition.selector should be of type function');
        }
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

export const register = function({ name, state, scope, updaters }) {
    if (epics[name]) {
        throw new Error(`Epic with name ${name} is already registered`);
    }

    epics[name] = { state, scope };
    updaters.forEach(({ conditions, handler }) => {
        conditions = conditions.map(processCondition);
        splitConditions(conditions).forEach(conditions => {
            const updater = { epic: name, handler, conditions };
            conditions.forEach(({ type }) => {
                if (!updaters[type]) updaters[type] = [];
                updaters[type].push(updater);
            });
        });
    });
};

export const unregister = function(epic) {
    const epicName = epic.name || epic;
    if (epics[epicName]) {
        delete epics[epicName];
        Object.keys(updaters).forEach(condition => {
            updaters[condition] = updaters[condition].filter(({ epic }) => epic !== epicName);
        });
    }
};

export const dispatch = (() => {
    let sourceAction, hasError, actionCache, conditionCache, epicListenerCache;
    const getHandlerParams = conditions => (
        conditions.map(condition => {
            if (actionCache.hasOwnProperty(condition.type)) {
                condition._value = condition.selector(actionCache[condition.type]);
                conditionCache.push(condition);
            }

            return condition.hasOwnProperty('_value') ? condition._value : condition.value;
        })
    );

    const processAction = (action, external) => {
        actionCache[action.type] = action.payload;
        try {
            (updaters[action.type] || []).forEach(({ epic: epicName, conditions, handler }) => {
                if (!conditions.every(condition => {
                    if (condition.type === action.type) {
                        if (condition.passive) return false;
                        return external || condition.selector(action.payload) !== condition.value;
                    }

                    return (
                        actionCache.hasOwnProperty(condition.type) ||
                        (condition.optional || condition.passive) && condition.value !== initialConditionValue
                    );
                })) return;

                const epic = epics[epicName];
                epic._state = epic._state || epic.state;
                epic._scope = epic._scope || epic.scope;

                const { state, scope, actions } = handler(getHandlerParams(conditions), {
                    state: epic._state, prevState: epic.state,
                    scope: epic._scope, prevScope: epic.scope,
                    sourceAction, currentAction: action
                });

                if (scope) {
                    epic._scope = { ...epic._scope, ...scope };
                }

                if (state) {
                    epic._state = { ...epic._state, ...state };
                    processAction({ type: epicName, payload: epic._state });
                }

                if (actions) {
                    actions.forEach(action => processAction(action));
                }
            });
        } catch (e) {
            hasError = true;
            throw e;
        }
    };

    return function (action) {
        // Fresh dispatch cycle
        hasError = false;
        actionCache = {};
        conditionCache = [];
        sourceAction = action;
        epicListenerCache = {};

        // dipatch cycle
        processAction(action, true);

        // End of dispatch cycle
        Object.keys(actionCache).forEach(actionType => {
            if (!hasError) {
                const listeners = epicListeners[actionType] || [];
                listeners.forEach(({ conditions, handler }) => {
                    if (conditions.some(condition => {
                        condition.value !== condition.selector(actionCache[condition.type])
                    })) handler(getHandlerParams(conditions));
                });
            }

            const epic = epics[actionType];
            if (epic) {
                if (!hasError) {
                    epic.state = epic._state;
                    epic.scope = epic._scope;
                }
                delete epic._state;
                delete epic._scope;
            }
        });

        conditionCache.forEach(condition => {
            if (!hasError) {
                condition.value = condition._value;
            }
            delete condition._value;
        });
    };
})();

export const addListener = function (conditions, handler) {
    const epicListener = { conditions, handler };

    conditions = conditions.map(processCondition);
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
    return epics[epicName] || epics;
};
