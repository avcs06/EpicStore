import EpicManager from '../../src/EpicManager';
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

    EpicManager.register({
        name: epic,
        scope: { counter: 0 },
        state: { counter: 0 },
        updaters: [
            new Updater([
                ...(action ? [{ type: action }] : []),
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
        ]
    });
};
