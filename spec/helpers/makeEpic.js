import EpicManager from '../../src/EpicManager';
import Updater from '../../src/Updater';

export const makeCounterEpic = (epic, action, additionalParams = {}) => {
    const {
        extraConditions = [],
        stateChange = state => ({ counter: state.counter + 1 }),
        scopeChange = scope => ({ counter: scope.counter + 1 }),
        actionsToDispatch = []
    } = additionalParams;

    EpicManager.register({
        name: epic,
        scope: { counter: 0 },
        state: { counter: 0 },
        updaters: [
            new Updater([
                ...(action ? [{ type: action }] : []),
                ...extraConditions
            ], (conditions, { state, scope }) => {
                if (additionalParams.withError) {
                    throw new Error('Fake Error');
                }

                return {
                    state: stateChange(state, conditions),
                    scope: scopeChange(scope, conditions),
                    actions: actionsToDispatch
                };
            })
        ]
    });
};
