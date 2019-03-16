import EpicManager from '../../src/EpicManager';
import Updater from '../../src/Updater';

export const makeCounterEpic = (epic, action, {
    extraConditions = [],
    withError = false,
    stateChange = state => ({ counter: ++state.counter }),
    scopeChange = scope => ({ counter: ++scope.counter }),
    actionsToDispatch = []
} = {}) => {
    EpicManager.register({
        name: epic,
        scope: { counter: 0 },
        state: { counter: 0 },
        updaters: [
            new Updater([
                ...(action ? [{ type: action }] : []),
                ...extraConditions
            ], (conditions, { state, scope }) => {
                if (withError) {
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
