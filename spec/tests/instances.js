import { Store } from '../../../src'
import { makeEpic, makeAction, makeCounterEpic } from '../helpers/makeEpic'
import Epic from '../../src/Epic'
import Updater from '../../src/Updater'
const store = new Store({ debug: true, patterns: true })

const normalAction = makeAction()
const patternAction = 'PATTERN_*'
const makeInstance = (() => {
    let counter = 0
    return () => makeOriginalEpic('INSTANCE_' + counter++, { counter: 0 }, null, [
        new Updater([normalAction, patternAction], ($0, { state }) => {
            return { state: { counter: state.counter + 1 } }
        })
    ])
})()

describe('Instances: ', function () {
    it('When an action target is mentioned only the targeted epic should be updated', function () {
        const epic = makeEpic()
        const instance1 = makeInstance()
        const instance2 = makeInstance()

        store.register(instance1)
        store.register(instance2)
        store.register(makeCounterEpic(epic, 'INSTANCE_*'))

        expect(getEpicState(store, instance1.name).counter).toBe(0)
        expect(getEpicState(store, instance2.name).counter).toBe(0)
        expect(getEpicState(store, epic).counter).toBe(0)

        store.dispatch({ type: normalAction, target: instance1.name })
        expect(getEpicState(store, instance1.name).counter).toBe(1)
        expect(getEpicState(store, instance2.name).counter).toBe(0)
        expect(getEpicState(store, epic).counter).toBe(1)

        store.dispatch({ type: patternAction, target: instance2.name })
        expect(getEpicState(store, instance1.name).counter).toBe(1)
        expect(getEpicState(store, instance2.name).counter).toBe(1)
        expect(getEpicState(store, epic).counter).toBe(2)
    })
})
