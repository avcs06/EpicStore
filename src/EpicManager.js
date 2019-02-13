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

    const value = condition.value || initialConditionValue;
    delete condition.value;
    condition.prevValue = condition.nextValue = value;

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

export const register = function({ name, state, updaters }) {
    if (epics[name]) {
        throw new Error(`Epic with name ${name} is already registered`);
    }

    epics[name] = { prevState: state, nextState: state };
    updaters.forEach(({ conditions, handler }) => {
        conditions = conditions.map(processCondition);
        splitConditions(conditions).forEach(conditions => {
            const updater = { epic: name, handler, conditions };
            conditions.forEach(condition => {
                if (!updaters[condition.type]) updaters[condition.type] = [];
                updaters[condition.type].push(updater);
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

let sourceAction;
let actionCache = {};
const getHandlerParams = conditions => (
    conditions.map(condition => {
        if (actionCache.hasOwnProperty(condition.type)) {
            condition.value = condition.selector(actionCache[condition.type]);
        }

        if (condition.value === initialConditionValue) {
            return null;
        }

        return condition.value;
    })
);

export const dispatch = function (action, internal) {
    if (!internal) {
        // Fresh dispatch cycle
        actionCache = {};
        sourceAction = action;
    }

    actionCache[action.type] = action.payload;
    updaters[action.type].forEach(({ epic: epicName, conditions, handler }) => {
        if (!conditions.every(condition => {
            if (condition.optional) return true;

            if (condition.type === action.type) {
                return !internal || condition.selector(action.payload) !== condition.value;
            }

            return (
                actionCache.hasOwnProperty(condition.type) ||
                condition.passive && condition.value !== initialConditionValue
            );
        })) return;

        const epic = epics[epicName];
        const { state, scope, actions } = handler(
            getHandlerParams(conditions),
            { state: epic.nextState, prevState: epic.prevState, sourceAction, currentAction: action }
        );

        if (change) {
            epic.nextState = { ...epic.nextState, ...change };
            dispatch({ type: epicName, payload: epic.nextState }, true);
        }

        if (actions) {
            actions.forEach(action => dispatch(action, true));
        }
    });

    if (!internal) {
        // End of dispatch cycle
        Object.keys(actionCache).forEach(actionType => {
            const listeners = epicListeners[actionType] || [];
            listeners.forEach(({ conditions, handler }) => {
                if (conditions.some(condition => {
                    condition.value !== condition.selector(actionCache[condition.type])
                })) handler(getHandlerParams(conditions));
            });

            const epic = epics[actionType];
            if (epic) epic.prevState = epic.nextState;
        });
    }
};

export const addListener = function (conditions, handler) {
    conditions = conditions.map(processCondition);
    conditions.forEach(condition => {
        if (!epicListeners[condition.type]) epicListeners[condition.type] = [];
        epicListeners[condition.type].push({ conditions, handler });
    });

    return function removeListener() {
        conditions.forEach(condition => {
            epicListeners[condition.type] = epicListeners[condition.type].filter(
                listener =>  handler !== listener.handler
            );
        });
    };
};

export const anyOf = function (...conditions) {
    return conditions;
};
