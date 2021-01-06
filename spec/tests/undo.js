import { Store } from '../../../src'
import { makeEpic, makeAction, makeCounterEpic } from '../helpers/makeEpic'
import { INITIAL_VALUE } from '../../src/object-utils'
const store = new Store({ undo: true, maxUndoStack: 3 })

describe('Undo: ', function () {
    it('Should Undo all the states on undo + Max undo + redo', function () {
        const epic1 = makeEpic()
        const epic2 = makeEpic()
        const epic3 = makeEpic()
        const epic4 = makeEpic()
        const action = makeAction()
        store.register(makeCounterEpic(epic1, action))
        store.register(makeCounterEpic(epic2, action))
        store.register(makeCounterEpic(epic3, epic1))
        store.register(makeCounterEpic(epic4, epic2))

        expect(getEpicState(store, epic1).counter).toBe(0)
        expect(getEpicState(store, epic2).counter).toBe(0)
        expect(getEpicState(store, epic3).counter).toBe(0)
        expect(getEpicState(store, epic4).counter).toBe(0)

        store.dispatch(action)
        store.dispatch(action)
        store.dispatch(action)
        store.dispatch(action)
        expect(getEpicState(store, epic1).counter).toBe(4)
        expect(getEpicState(store, epic2).counter).toBe(4)
        expect(getEpicState(store, epic3).counter).toBe(4)
        expect(getEpicState(store, epic4).counter).toBe(4)

        store.undo()
        expect(getEpicState(store, epic1).counter).toBe(3)
        expect(getEpicState(store, epic2).counter).toBe(3)
        expect(getEpicState(store, epic3).counter).toBe(3)
        expect(getEpicState(store, epic4).counter).toBe(3)
        store.undo()
        store.undo()
        store.undo()
        expect(getEpicState(store, epic1).counter).toBe(1)
        expect(getEpicState(store, epic2).counter).toBe(1)
        expect(getEpicState(store, epic3).counter).toBe(1)
        expect(getEpicState(store, epic4).counter).toBe(1)

        store.redo()
        store.redo()
        store.redo()
        expect(getEpicState(store, epic1).counter).toBe(4)
        expect(getEpicState(store, epic2).counter).toBe(4)
        expect(getEpicState(store, epic3).counter).toBe(4)
        expect(getEpicState(store, epic4).counter).toBe(4)
    })

    it('Various Object State Undo', function () {
        const epic = makeEpic()
        const action1 = makeAction()
        const action2 = makeAction()
        const action3 = makeAction()
        store.register({
            name: epic,
            state: { a: { b: 1 } },
            updaters: [
                {
                    conditions: [action1, action2, action3],
                    handler: (conditions, { sourceAction: { type } }) => {
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
                }
            ]
        })
        store.register(makeCounterEpic(makeEpic(), epic))

        store.dispatch(action2)
        expect(getEpicState(store, epic)).toEqual({ a: { b: 2 } })

        store.dispatch(action1)
        expect(getEpicState(store, epic)).toEqual({ a: { b: 2 }, c: 1 })

        store.dispatch(action3)
        expect(getEpicState(store, epic)).toEqual({ a: 2, c: 1 })

        store.undo()
        expect(getEpicState(store, epic)).toEqual({ a: { b: 2 }, c: 1 })

        store.undo()
        expect(getEpicState(store, epic)).toEqual({ a: { b: 2 } })

        store.undo()
        expect(getEpicState(store, epic)).toEqual({ a: { b: 1 } })

        store.redo()
        expect(getEpicState(store, epic)).toEqual({ a: { b: 2 } })

        store.redo()
        expect(getEpicState(store, epic)).toEqual({ a: { b: 2 }, c: 1 })

        store.redo()
        expect(getEpicState(store, epic)).toEqual({ a: 2, c: 1 })
    })

    it('Primitive Undo', function () {
        const epic = makeEpic()
        const action1 = makeAction()
        const action2 = makeAction()
        const action3 = makeAction()
        store.register({
            name: epic,
            state: null,
            updaters: [
                {
                    conditions: [action1, action2, action3],
                    handler: (conditions, { sourceAction: { type } }) => {
                        if (type === action1) {
                            return { state: [1, 2, 3] }
                        } else if (type === action2) {
                            return { state: 'a' }
                        } else {
                            return { state: Function.prototype }
                        }
                    }
                }
            ]
        })

        store.dispatch(action1)
        expect(getEpicState(store, epic)).toEqual([1, 2, 3])

        store.dispatch(action2)
        expect(getEpicState(store, epic)).toEqual('a')

        store.dispatch(action3)
        expect(getEpicState(store, epic)).toEqual(Function.prototype)

        store.undo()
        expect(getEpicState(store, epic)).toEqual('a')

        store.undo()
        expect(getEpicState(store, epic)).toEqual([1, 2, 3])

        store.undo()
        expect(getEpicState(store, epic)).toEqual(INITIAL_VALUE)

        store.redo()
        expect(getEpicState(store, epic)).toEqual([1, 2, 3])

        store.redo()
        expect(getEpicState(store, epic)).toEqual('a')

        store.redo()
        expect(getEpicState(store, epic)).toEqual(Function.prototype)
    })
})
