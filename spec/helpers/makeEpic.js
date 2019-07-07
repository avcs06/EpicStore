import Epic from '../../src/Epic';
import Action from '../../src/Action';
import Updater from '../../src/Updater';

export const makeGetter = (() => {
    let counter = 0;
    return name => type => () => name.toUpperCase() + '_' + type.toUpperCase() + '__' + (counter++);
})();

export const makeCounterEpic = (epic, action, additionalParams = {}) => {
    const {
        extraConditions = [],
        stateChange = state => ({ counter: state.counter + 1 }),
        scopeChange = scope => ({ counter: scope.counter + 1 }),
        actionsToDispatch = [],
        verify = Function.prototype
    } = additionalParams;

    return new Epic(epic, { counter: 0 }, { counter: 0 }, [
        new Updater([
            ...(action ?
                    action.constructor === Array ?
                        action : [action.type ? action : new Action(action)] : []),
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
