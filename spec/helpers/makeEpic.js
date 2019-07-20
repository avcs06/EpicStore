import Epic from '../../src/Epic';
import Updater from '../../src/Updater';
import Condition from '../../src/Condition';

const make = (() => {
    let counter = 0;
    return type => () => type.toUpperCase() + '__' + (counter++);
})();

export const makeEpic = make('epic');
export const makeAction = make('action');
export const makeCounterEpic = (epic, condition, additionalParams = {}) => {
    const {
        extraConditions = [],
        stateChange = state => ({ counter: state.counter + 1 }),
        scopeChange = scope => ({ counter: scope.counter + 1 }),
        actionsToDispatch = [],
        verify = Function.prototype
    } = additionalParams;

    return new Epic(epic, { counter: 0 }, { counter: 0 }, [
        new Updater([
            ...(condition ?
                    condition.constructor === Array ?
                    condition : [condition.type ? condition : new Condition(condition)] : []),
            ...extraConditions
        ], (conditions, { state, scope, currentAction }) => {
            if (additionalParams.withError) {
                throw new Error('Fake Error');
            }

            verify(conditions, { state, scope, currentAction });

            return {
                state: stateChange(state, conditions),
                scope: scopeChange(scope, conditions),
                actions: actionsToDispatch
            };
        })
    ]);
};
