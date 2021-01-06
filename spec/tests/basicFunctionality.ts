
import { createStore, makeEpic as makeOriginalEpic } from '../../src'
import { getEpicScope, getEpicState, getStoreListeners, getUpdaterConditions } from '../../src/store'
import { makeEpic, makeAction, makeCounterEpic } from '../helpers/makeEpic'
const store = createStore()

describe('Basic functionalities', function () {
    it('Should update epic state and scope on action', function () {
        const epic = makeEpic()
        const action = makeAction()

        store.register(makeCounterEpic(epic, action))

        // Using Action as object
        store.dispatch({ type: action })
        expect(getEpicState(store, epic).counter).toBe(1)
        expect(getEpicScope(store, epic).counter).toBe(1)

        // Using action as string
        store.dispatch(action)
        expect(getEpicState(store, epic).counter).toBe(2)
        expect(getEpicScope(store, epic).counter).toBe(2)
    })

    it('Should unregister epic', function () {
        const epic = makeEpic()
        const action = makeAction()
        const verify = jasmine.createSpy('verify')

        store.register(makeCounterEpic(epic, action, { verify }))
        store.unregister(epic)

        expect(getEpicState(store, epic)).toBe(undefined)
        store.dispatch(action)
        expect(verify).not.toHaveBeenCalled()
    })

    it('Unregister should handle non existant epic gracefully', function () {
        expect(() => store.unregister('AVCS')).not.toThrow()
    })

    it('Should dispatch epic action on epic state update', function () {
        const epic1 = makeEpic()
        const epic2 = makeEpic()
        const action = makeAction()
        store.register(makeCounterEpic(epic1, action))
        store.register(makeCounterEpic(epic2, epic1))

        store.dispatch(action)
        expect(getEpicState(store, epic1).counter).toBe(1)
        expect(getEpicState(store, epic2).counter).toBe(1)
    })

    it('Should revert state, scope and condition to previous state on error', function () {
        const epic1 = makeEpic()
        const epic2 = makeEpic()
        const action = makeAction()
        const additionalParams: any = {}
        store.register(makeCounterEpic(epic1, action))
        store.register(makeCounterEpic(epic2, epic1, additionalParams))

        store.dispatch(action)
        expect(getEpicState(store, epic1).counter).toBe(1)
        expect(getEpicScope(store, epic2).counter).toBe(1)
        expect(getUpdaterConditions(store, epic2, 'R[0]')[0].value.counter).toBe(1)

        additionalParams.withError = true
        expect(() => store.dispatch(action)).toThrow()
        expect(getEpicState(store, epic1).counter).toBe(1)
        expect(getEpicScope(store, epic2).counter).toBe(1)
        expect(getUpdaterConditions(store, epic2, 'R[0]')[0].value.counter).toBe(1)

        additionalParams.withError = false
        store.dispatch(action)
        expect(getEpicState(store, epic1).counter).toBe(2)
        expect(getEpicScope(store, epic2).counter).toBe(2)
        expect(getUpdaterConditions(store, epic2, 'R[0]')[0].value.counter).toBe(2)
    })

    it('Epic listener condition value should get updated, even if the listerner throws an error', function () {
        const epic = makeEpic()
        const action = makeAction()

        store.register(makeCounterEpic(epic, action))
        store.addListener(epic, () => { throw new Error('Fake Error') })

        expect(() => store.dispatch(action)).toThrow([new Error('Fake Error')])
        expect(getStoreListeners(store, epic)[0].conditions[0].value.counter).toBe(1)
    })

    it('Should not dispatch epic action on passive update', function () {
        const epic1 = makeEpic()
        const epic2 = makeEpic()
        const action = makeAction()

        const epic = makeOriginalEpic(epic1)
        store.register(epic)
        epic.useReducer(action, () => ({
            state: { a: 1 },
            passive: true
        }))

        store.register(makeCounterEpic(epic2, epic1))
        store.dispatch(action)
        expect(getEpicState(store, epic2).counter).toBe(undefined)
    })

    it('Adding a handler on registered epic should function as expected', function () {
        const epic1 = makeEpic()
        const action = makeAction()
        const handlerSpy = jasmine.createSpy()

        const epic = makeOriginalEpic(epic1)
        store.register(epic)
        epic.useReducer(action, handlerSpy)

        store.dispatch(action)
        expect(handlerSpy).toHaveBeenCalledWith(undefined, { type: action })
    })

    it('Removing a handler on registered epic should function as expected', function () {
        const epic1 = makeEpic()
        const action = makeAction()
        const handlerSpy = jasmine.createSpy()

        const epic = makeOriginalEpic(epic1)
        const off = epic.useReducer(action, handlerSpy)
        store.register(epic)
        off()

        store.dispatch(action)
        expect(handlerSpy).not.toHaveBeenCalled()
    })
})
