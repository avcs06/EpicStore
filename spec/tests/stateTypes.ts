import { createStore, makeEpic as makeOriginalEpic } from '../../src'
import { getEpicState } from '../../src/store'
import { makeEpic, makeAction } from '../helpers/makeEpic'
const store = createStore()

describe('State types: ', function () {
    it('Primitive State to primitive', function () {
        const epic1 = makeEpic()
        const action = makeAction()
        const epic = makeOriginalEpic(epic1)
        store.register(epic)

        epic.useReducer(action, () => ({ state: 1 }))
        store.dispatch(action)
        expect(getEpicState(store, epic1)).toBe(1)
    })

    it('Deep Object State 1', function () {
        const epic1 = makeEpic()
        const action = makeAction()
        const epic = makeOriginalEpic(epic1)
        store.register(epic)

        epic.useReducer(action, () => ({ state: { a: { b: 2 } } }))
        store.dispatch(action)
        expect(getEpicState(store, epic1).a.b).toBe(2)
    })

    it('Deep Object State 2', function () {
        const epic1 = makeEpic()
        const action1 = makeAction()
        const action2 = makeAction()

        const epic = makeOriginalEpic(epic1)
        store.register(epic)

        epic.useReducer(action1, () => ({ state: { a: { b: 1 } } }))
        epic.useReducer(action2, () => ({ state: { c: 2 } }))

        store.dispatch(action1)
        store.dispatch(action2)

        expect(getEpicState(store, epic1).a.b).toBe(1)
    })

    it('Deep Object State 3', function () {
        const epic1 = makeEpic()
        const action1 = makeAction()
        const action2 = makeAction()

        const epic = makeOriginalEpic(epic1)
        store.register(epic)

        epic.useReducer(action1, () => ({ state: { a: [1, 2, 3] } }))
        epic.useReducer(action2, () => ({ state: { c: 2 } }))

        store.dispatch(action1)
        store.dispatch(action2)

        expect(getEpicState(store, epic1).a[0]).toBe(1)
    })

    it('Array State', function () {
        const epic1 = makeEpic()
        const action = makeAction()
        const epic = makeOriginalEpic(epic1)
        store.register(epic)

        epic.useReducer(action, () => ({ state: [1, 2, 3, 4] }))
        store.dispatch(action)
        expect(getEpicState(store, epic1)[3]).toBe(4)
    })

    it('No State to primitive', function () {
        const epic1 = makeEpic()
        const action = makeAction()
        const epic = makeOriginalEpic(epic1)
        store.register(epic)

        epic.useReducer(action, () => ({ state: 1 }))
        store.dispatch(action)
        expect(getEpicState(store, epic1)).toBe(1)
    })

    it('No State to object', function () {
        const epic1 = makeEpic()
        const action = makeAction()
        const epic = makeOriginalEpic(epic1)
        store.register(epic)

        epic.useReducer(action, () => ({ state: { a: 1 } }))
        store.dispatch(action)
        expect(getEpicState(store, epic1).a).toBe(1)
    })
})
