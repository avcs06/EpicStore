import { createStore, makeEpic as makeOriginalEpic, withTarget } from '../../src'
import { makeEpic, makeAction, makeCounterEpic } from '../helpers/makeEpic'
import { getEpicState } from '../../src/store'
const store = createStore({ patterns: true })

const normalAction = makeAction()
const patternAction = 'PATTERN_*'

let counter = 0
const makeInstance = (withTarget?) => {
    const epic = makeOriginalEpic(withTarget ? 'TARGET_' + counter++ : null)
    epic.useState({ counter: 0 })
    epic.useReducer([normalAction, patternAction], function ($0) {
        return { state: { counter: this.state.counter + 1 } }
    })
    return epic
}

describe('Targets: ', function () {
    it('When an action target is mentioned only the targeted epic should be updated', function () {
        const epic = makeEpic()
        const instance1 = makeInstance(true)
        const instance2 = makeInstance(true)
        const instance3 = makeInstance()

        store.register(instance1)
        store.register(instance2)
        store.register(instance3)
        store.register(makeCounterEpic(epic, 'TARGET_*', {
            state: { counter: 0 }
        }))

        expect(getEpicState(store, instance1).counter).toBe(0)
        expect(getEpicState(store, instance2).counter).toBe(0)
        expect(getEpicState(store, instance3).counter).toBe(0)
        expect(getEpicState(store, epic).counter).toBe(0)

        store.dispatch({ type: normalAction, target: instance1 })
        expect(getEpicState(store, instance1).counter).toBe(1)
        expect(getEpicState(store, instance2).counter).toBe(0)
        expect(getEpicState(store, instance3).counter).toBe(0)
        expect(getEpicState(store, epic).counter).toBe(1)

        store.dispatch(withTarget(patternAction, instance2))
        expect(getEpicState(store, instance1).counter).toBe(1)
        expect(getEpicState(store, instance2).counter).toBe(1)
        expect(getEpicState(store, instance3).counter).toBe(0)
        expect(getEpicState(store, epic).counter).toBe(2)

        store.dispatch(withTarget(patternAction, 'TARGET_*'))
        expect(getEpicState(store, instance1).counter).toBe(2)
        expect(getEpicState(store, instance2).counter).toBe(2)
        expect(getEpicState(store, instance3).counter).toBe(0)
        expect(getEpicState(store, epic).counter).toBe(3)
    })
})
