import { withSelector, withGuard, withPayload, resolve, createStore, makeEpic as makeOriginalEpic } from '../../../src'
import { getEpicState, getUpdaterConditions } from '../../../src/store'
import { makeEpic, makeAction, makeCounterEpic } from '../../helpers/makeEpic'
const store = createStore()

describe('Condition Selector: ', function () {
    it('Should trigger handler only when the selector value changed', function () {
        const epic1 = makeEpic()
        const epic2 = makeEpic()
        const action = makeAction()

        store.register(makeCounterEpic(epic1, action))
        store.register(makeCounterEpic(epic2, withSelector(epic1, ({ counter }) => Math.floor(counter / 3))))

        for (let i = 0; i < 9; i++) store.dispatch(action)
        expect(getEpicState(store, epic1).counter).toBe(9)
        // epic 2 will be executed only when epic1 value is changed to 1, 3, 6, 9 for first time
        expect(getEpicState(store, epic2).counter).toBe(4)
    })
})

describe('Condition Guard: ', function () {
    it('Should trigger handler only when the guard value returns true', function () {
        const epic1 = makeEpic()
        const epic2 = makeEpic()
        const action = makeAction()
        store.register(makeCounterEpic(epic1, action))
        store.register(makeCounterEpic(epic2, withGuard(epic1, ({ counter }) => counter > 3)))

        for (let i = 0; i < 5; i++) store.dispatch(action)
        expect(getEpicState(store, epic1).counter).toBe(5)
        // epic 2 will be executed only when epic1 value is changed to 4, 5
        expect(getEpicState(store, epic2).counter).toBe(2)
    })
})

describe('Condition Value: ', function () {
    it('Should execute epic handler if the condition value didnt change, and the action is external', function () {
        const epic = makeEpic()
        const action = makeAction()
        const valueSymbol = Symbol('value')
        store.register(makeCounterEpic(epic, action))

        for (let i = 0; i < 5; i++) store.dispatch(withPayload(action, valueSymbol))
        expect(getEpicState(store, epic).counter).toBe(5)
    })

    it('Should not execute epic handler if the condition value didnt change, and the action is internal', function () {
        const epic1 = makeEpic()
        const epic2 = makeEpic()
        const action = makeAction()

        const epic = makeOriginalEpic(epic1)
        epic.useReducer(resolve({ action }), function ({ action }) {
            expect(action).toBe('avcs')
            return { state: { counter1: (this.state.counter1 || 0) + 1 } }
        })

        store.register(epic)
        store.register(makeCounterEpic(epic2, withSelector(epic, ({ counter2 }) => counter2)))

        store.dispatch(withPayload(action, 'avcs'))
        expect(getEpicState(store, epic1).counter1).toBe(1)
        // epic1 is an internal action and condition value not changed
        expect(getEpicState(store, epic2).counter).toBe(undefined)
    })

    it('Condition value should be updated and not reset even if the condition not met', function () {
        const epic1 = makeEpic()
        const epic2 = makeEpic()
        const epic3 = makeEpic()
        const action1 = makeAction()
        const action2 = makeAction()
        const action3 = makeAction()

        let epic
        store.register(epic = makeCounterEpic(epic1, action1))
        store.register(makeCounterEpic(epic2, action2))
        store.register(makeCounterEpic(epic3, [action3, epic2, epic]))

        store.dispatch(action1)
        // Handler should not be executed
        expect(getEpicState(store, epic3).counter).toBe(undefined)
        // Met condition should be updated event if the handler is not executed
        expect(getUpdaterConditions(store, epic3, 'R[0]')[2].value.counter).toBe(1)

        store.dispatch(action2)
        // Handler should not be executed
        expect(getEpicState(store, epic3).counter).toBe(undefined)
        // Unmet condition should not get reset
        expect(getUpdaterConditions(store, epic3, 'R[0]')[2].value.counter).toBe(1)
    })
})
