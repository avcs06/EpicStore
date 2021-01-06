import { createStore, anyOf } from '../../../src'
import { getEpicState, splitNestedValues } from '../../../src/store'
import { makeEpic, makeAction, makeCounterEpic } from '../../helpers/makeEpic'
const store = createStore()

describe('AnyOf conditions: ', function () {
    it('Should receive only one value in conditionValues per anyOf', function () {
        const action2 = makeAction()
        const action3 = makeAction()
        store.register(makeCounterEpic(makeEpic(), [anyOf(action2, action3)], {
            verify: conditions => {
                expect(conditions.length).toBe(1)
            }
        }))

        store.dispatch(action2)
    })

    it('Should update state on any of the actions', function () {
        const activeEpic = makeEpic()
        const anyOfAction1 = makeAction()
        const anyOfAction2 = makeAction()
        store.register(makeCounterEpic(activeEpic, [anyOf(anyOfAction1, anyOfAction2)]))

        store.dispatch(anyOfAction1)
        expect(getEpicState(store, activeEpic).counter).toBe(1)
        store.dispatch(anyOfAction2)
        expect(getEpicState(store, activeEpic).counter).toBe(2)
    })

    it('Should split properly when there are multiple anyOf', function () {
        const splits = splitNestedValues([[1, 2], [3, 4], [5, 6]])
        expect(splits.length).toBe(2 * 2 * 2)
        expect(splits).toEqual([
            [1, 3, 5],
            [1, 3, 6],
            [1, 4, 5],
            [1, 4, 6],
            [2, 3, 5],
            [2, 3, 6],
            [2, 4, 5],
            [2, 4, 6]
        ])
    })
})
