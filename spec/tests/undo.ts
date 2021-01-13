import { createStore, readonly, resolve, withUndoPoint, makeEpic as makeOriginalEpic, anyOf } from '../../src'
import { makeEpic, makeAction, makeCounterEpic } from '../helpers/makeEpic'
import { INITIAL_VALUE } from '../../src/object'
import { getEpicScope, getEpicState, getStoreListeners, getUpdaterConditions } from '../../src/store'
import { withoutUndoPoint } from '../../src/action'
const store1 = createStore({ undo: { maxStack: 3, manualUndoPoints: true } })
const store2 = createStore({ undo: { maxStack: 3 } })

describe('Undo: ', function () {
    it('Should Undo state, scope, condition values + store listeners should be called', function () {
        const epic1 = makeEpic()
        const epic2 = makeEpic()
        const epic3 = makeEpic()
        const epic4 = makeEpic()
        const action = makeAction()
        const listenerSpy = jasmine.createSpy('listener')

        store1.register(makeCounterEpic(epic1, action, { state: { counter: 0 }, scope: { counter: 0 } }))
        store1.register(makeCounterEpic(epic2, action, { state: { counter: 0 }, scope: { counter: 0 } }))
        store1.register(makeCounterEpic(epic3, epic1, { state: { counter: 0 }, scope: { counter: 0 } }))
        store1.register(makeCounterEpic(epic4, epic2, { state: { counter: 0 }, scope: { counter: 0 } }))
        store1.addListener(resolve([`${epic1}.counter`, `${epic2}.counter`, `${epic3}.counter`, `${epic4}.counter`]), listenerSpy)

        function expectCounterToBe (value, skipListener?) {
            [epic1, epic2, epic3, epic4].forEach(epic => {
                [getEpicScope, getEpicState].forEach(method => {
                    expect(method(store1, epic).counter).toBe(value)
                })
                expect(getStoreListeners(store1, epic)[0].conditions[0].value).toBe(value)
            })

            !skipListener && expect(listenerSpy).toHaveBeenCalledWith([value, value, value, value], jasmine.any(Object))
            expect(getUpdaterConditions(store1, epic3, 'R[0]')[0].value.counter).toBe(value)
            expect(getUpdaterConditions(store1, epic4, 'R[0]')[0].value.counter).toBe(value)
        }

        expectCounterToBe(0, true);
        [1, 2, 3, 4].forEach(() => store1.dispatch(withUndoPoint(action)))
        expectCounterToBe(4)

        store1.undo()
        expectCounterToBe(3)

        store1.undo()
        store1.undo()
        store1.undo() // this wont have any effect as max stack has already reached
        expectCounterToBe(1)

        store1.redo()
        store1.redo()
        store1.redo()
        expectCounterToBe(4)
    })

    it('Reducers should be called with proper readonly values after an undo', function () {
        const epic1 = makeEpic()
        const epic2 = makeEpic()
        const epic3 = makeEpic()
        const action1 = makeAction()
        const action2 = makeAction()
        const reducerSpy = jasmine.createSpy('reducer')

        store2.register(makeCounterEpic(epic1, action1))
        store2.register(makeCounterEpic(epic2, action2))

        const epic = makeOriginalEpic(epic3)
        epic.useReducer(resolve([readonly(epic1), epic2]), reducerSpy)
        store2.register(epic)

        store2.dispatch(action1)
        store2.dispatch(action1)
        store2.dispatch(action1)
        store2.dispatch(action1)
        expect(getEpicState(store2, epic1).counter).toBe(4)

        store2.undo()
        store2.undo()
        store2.undo()
        expect(getEpicState(store2, epic1).counter).toBe(1)

        store2.dispatch(action2)
        expect(reducerSpy).toHaveBeenCalledWith([{ counter: 1 }, { counter: 1 }], jasmine.any(Object))
    })

    it('Various Object State Undo', function () {
        const epic1 = makeEpic()
        const action1 = makeAction()
        const action2 = makeAction()
        const action3 = makeAction()

        const epic = makeOriginalEpic(epic1)
        epic.useState({ a: { b: 1 } })
        epic.useReducer(
            anyOf(action1, action2, action3),
            (conditions, { type }) => {
                if (type === action1) {
                    return {
                        state: { c: 1 }
                    }
                } else if (type === action2) {
                    return {
                        state: { a: { b: 2 } }
                    }
                } else {
                    return {
                        state: { a: 2 }
                    }
                }
            }
        )

        store2.register(epic)
        store2.dispatch(action2)
        expect(getEpicState(store2, epic)).toEqual({ a: { b: 2 } })

        store2.dispatch(action1)
        expect(getEpicState(store2, epic)).toEqual({ a: { b: 2 }, c: 1 })

        store2.dispatch(action3)
        expect(getEpicState(store2, epic)).toEqual({ a: 2, c: 1 })

        store2.undo()
        expect(getEpicState(store2, epic)).toEqual({ a: { b: 2 }, c: 1 })

        store2.undo()
        expect(getEpicState(store2, epic)).toEqual({ a: { b: 2 } })

        store2.undo()
        expect(getEpicState(store2, epic)).toEqual({ a: { b: 1 } })

        store2.redo()
        expect(getEpicState(store2, epic)).toEqual({ a: { b: 2 } })

        store2.redo()
        expect(getEpicState(store2, epic)).toEqual({ a: { b: 2 }, c: 1 })

        store2.redo()
        expect(getEpicState(store2, epic)).toEqual({ a: 2, c: 1 })
    })

    it('Primitive Undo', function () {
        const epic1 = makeEpic()
        const action1 = makeAction()
        const action2 = makeAction()
        const action3 = makeAction()

        const epic = makeOriginalEpic(epic1)
        epic.useReducer(
            anyOf(action1, action2, action3),
            (conditions, { type }) => {
                if (type === action1) {
                    return { state: [1, 2, 3] }
                } else if (type === action2) {
                    return { state: 'a' }
                } else {
                    return { state: Function.prototype }
                }
            }
        )

        store2.register(epic)

        store2.dispatch(action1)
        expect(getEpicState(store2, epic)).toEqual([1, 2, 3])

        store2.dispatch(action2)
        expect(getEpicState(store2, epic)).toEqual('a')

        store2.dispatch(action3)
        expect(getEpicState(store2, epic)).toEqual(Function.prototype)

        store2.undo()
        expect(getEpicState(store2, epic)).toEqual('a')

        store2.undo()
        expect(getEpicState(store2, epic)).toEqual([1, 2, 3])

        store2.undo()
        expect(getEpicState(store2, epic)).toEqual(INITIAL_VALUE)

        store2.redo()
        expect(getEpicState(store2, epic)).toEqual([1, 2, 3])

        store2.redo()
        expect(getEpicState(store2, epic)).toEqual('a')

        store2.redo()
        expect(getEpicState(store2, epic)).toEqual(Function.prototype)
    })

    it('Merge multiple dispatches to multiple undo', function () {
        const action = makeAction()
        const epic = makeOriginalEpic()
        epic.useState({ counter: 0 })
        epic.useReducer(action, function () {
            return { state: { counter: this.state.counter + 1 } }
        })

        store1.register(epic)
        store2.register(epic)

        store1.dispatch(action)
        expect(getEpicState(store1, epic).counter).toEqual(1)

        store1.dispatch(action)
        expect(getEpicState(store1, epic).counter).toEqual(2)

        store1.dispatch(withUndoPoint(action))
        expect(getEpicState(store1, epic).counter).toEqual(3)

        store1.undo()
        expect(getEpicState(store1, epic).counter).toEqual(2)

        store1.undo()
        expect(getEpicState(store1, epic).counter).toEqual(0)

        store2.dispatch(action)
        expect(getEpicState(store2, epic).counter).toEqual(1)

        store2.dispatch(action)
        expect(getEpicState(store2, epic).counter).toEqual(2)

        store2.dispatch(withoutUndoPoint(action))
        expect(getEpicState(store2, epic).counter).toEqual(3)

        store2.undo()
        expect(getEpicState(store2, epic).counter).toEqual(1)

        store2.undo()
        expect(getEpicState(store2, epic).counter).toEqual(0)
    })

    it('Merge multiple independant epics on undo', function () {
        const epic1 = makeEpic()
        const epic2 = makeEpic()
        const action1 = makeAction()
        const action2 = makeAction()

        const store = createStore({ undo: true })
        store.register(makeCounterEpic(epic1, action1))
        store.register(makeCounterEpic(epic2, action2))

        store.dispatch(action1)
        expect(getEpicState(store, epic1).counter).toEqual(1)
        expect(getEpicState(store, epic2)).toEqual(INITIAL_VALUE)

        store.dispatch(withoutUndoPoint(action2))
        expect(getEpicState(store, epic1).counter).toEqual(1)
        expect(getEpicState(store, epic2).counter).toEqual(1)

        store.undo()
        expect(getEpicState(store, epic1)).toEqual(INITIAL_VALUE)
        expect(getEpicState(store, epic2)).toEqual(INITIAL_VALUE)
    })
})
