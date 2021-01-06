import { getEpicState, createStore } from '../../../src/store'
import { makeEpic, makeAction, makeCounterEpic } from '../../helpers/makeEpic'
const store = createStore()

describe('Passive condition: ', function () {
    it('Should not trigger handler on passive condition change', function () {
        const epic1 = makeEpic()
        const epic2 = makeEpic()
        const action = makeAction()
        store.register(makeCounterEpic(epic1, action))
        store.register(makeCounterEpic(epic2, makeAction(), {
            extraConditions: [{ type: epic1, passive: true }]
        }))

        store.dispatch(action)
        expect(getEpicState(store, epic1).counter).toBe(1)
        expect(getEpicState(store, epic2).counter).toBe(undefined)
    })

    // To provide the latest state of passive action
    it('Should trigger handler even if passive condition is updated after active condition', function () {
        const epic1 = makeEpic()
        const epic2 = makeEpic()
        const epic3 = makeEpic()
        const epic4 = makeEpic()
        const action = makeAction()

        store.register(makeCounterEpic(epic1, action))
        store.register(makeCounterEpic(epic2, action))

        store.register(makeCounterEpic(epic3, epic2, {
            extraConditions: [{ type: epic1, passive: true }]
        }))
        store.register(makeCounterEpic(epic4, epic1, {
            extraConditions: [{ type: epic2, passive: true }]
        }))

        store.dispatch(action)
        expect(getEpicState(store, epic1).counter).toBe(1)
        expect(getEpicState(store, epic2).counter).toBe(1)
        expect(getEpicState(store, epic3).counter).toBe(1)
        expect(getEpicState(store, epic4).counter).toBe(1)
    })
})
