import { makeEpic as makeOriginalEpic, resolve } from '../../src'

const make = (() => {
    let counter = 0
    return (type: string) => () => type.toUpperCase() + '__' + (counter++)
})()

export const makeEpic = make('epic')

export const makeAction = make('action')

export const makeCounterEpic = (epicName, conditions, additionalParams: any = {}) => {
    const {
        stateChange = state => ({ counter: (state.counter || 0) + 1 }),
        scopeChange = scope => ({ counter: (scope.counter || 0) + 1 }),
        actionsToDispatch = [],
        verify = Function.prototype
    } = additionalParams

    const epic = makeOriginalEpic(epicName)
    epic.useReducer(resolve([
        ...(conditions ? conditions.constructor === Array ? conditions : [conditions] : [])
    ]), function (conditions) {
        if (additionalParams.withError) {
            throw new Error('Fake Error')
        }

        verify(conditions)

        return {
            state: stateChange(this.state, conditions),
            scope: scopeChange(this.scope, conditions),
            actions: actionsToDispatch
        }
    })

    return epic
}
