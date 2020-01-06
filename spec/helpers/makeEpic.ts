import { Epic, resolve } from '../../src';

const make = (() => {
    let counter = 0;
    return (type: string) => () => type.toUpperCase() + '__' + (counter++);
})();
export const makeEpic = make('epic');
export const makeAction = make('action');

export const makeCounterEpic = (epicName, conditions, additionalParams: any = {}) => {
    const {
        stateChange = state => ({ counter: state.counter + 1 }),
        scopeChange = scope => ({ counter: scope.counter + 1 }),
        actionsToDispatch = [],
        verify = Function.prototype
    } = additionalParams;

    const epic = new Epic(epicName, { counter: 0 }, { counter: 0 });
    epic.on(resolve([
        ...(conditions ? conditions.constructor === Array ? conditions : [conditions] : [])
    ]), (conditions, { state, scope }) => {
        if (additionalParams.withError) {
            throw new Error('Fake Error');
        }

        verify(conditions, { state, scope });

        return {
            state: stateChange(state, conditions),
            scope: scopeChange(scope, conditions),
            actions: actionsToDispatch
        };
    });

    return epic;
};
