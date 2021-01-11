import { makeEpic, makeAction, makeCounterEpic } from '../helpers/makeEpic'
import { getEpicState } from '../../src/store'
import { withPayload, createStore, readonly, anyOf, resolve } from '../../src'
const store = createStore({ patterns: true })

describe('Pattern Conditions: ', function () {
    it('Updater handler should be executed if it has any action as a condition on any action', function () {
        const epic = makeEpic()
        store.register(makeCounterEpic(epic, '*'))

        store.dispatch(makeAction())
        expect(getEpicState(store, epic).counter).toBe(1)
    })

    it('Updater handler should receive action object as condition value if the condition is a pattern', function () {
        const epic = makeEpic()
        const action = makeAction()
        const verify = jasmine.createSpy('verify')
        store.register(makeCounterEpic(epic, '*', { verify }))
        store.dispatch(withPayload(action, 1))
        expect(verify).toHaveBeenCalledWith([{ type: action, payload: 1 }])
    })

    it('If there are multiple updaters listening to all action conditions, the cycle shouldnt go into infinite loop', function () {
        store.register(makeCounterEpic(makeEpic(), '*'))
        store.register(makeCounterEpic(makeEpic(), '*'))
        expect(() => store.dispatch(makeAction())).not.toThrow()
    })

    it('Epics should be executed on pattern conditions', function () {
        const epic1 = makeEpic()
        const epic2 = makeEpic()
        const epic3 = makeEpic()
        store.register(makeCounterEpic(epic1, 'PATTERN_1*'))
        store.register(makeCounterEpic(epic2, 'PATTERN_2*'))
        store.register(makeCounterEpic(epic3, [epic1, epic2]))

        store.dispatch('PATTERN_11')
        expect(getEpicState(store, epic1).counter).toBe(1)
        expect(getEpicState(store, epic2).counter).toBe(undefined)
        expect(getEpicState(store, epic3).counter).toBe(undefined)

        store.dispatch('PATTERN_22')
        expect(getEpicState(store, epic1).counter).toBe(1)
        expect(getEpicState(store, epic2).counter).toBe(1)
        expect(getEpicState(store, epic3).counter).toBe(undefined)
    })

    it('Different pattern types', function () {
        const epic1 = makeEpic()
        const epic2 = makeEpic()
        const epic3 = makeEpic()
        const epic4 = makeEpic()

        store.register(makeCounterEpic(epic1, 'PATTERN_*'))
        store.register(makeCounterEpic(epic2, '*_A'))
        store.register(makeCounterEpic(epic3, 'PATTERN*1'))
        store.register(makeCounterEpic(epic4, '*A*'))

        store.dispatch('PATTERN_22')
        expect(getEpicState(store, epic1).counter).toBe(1)
        expect(getEpicState(store, epic2).counter).toBe(undefined)
        expect(getEpicState(store, epic3).counter).toBe(undefined)
        expect(getEpicState(store, epic4).counter).toBe(1)

        store.dispatch('PATTERN_A')
        expect(getEpicState(store, epic1).counter).toBe(2)
        expect(getEpicState(store, epic2).counter).toBe(1)
        expect(getEpicState(store, epic3).counter).toBe(undefined)
        expect(getEpicState(store, epic4).counter).toBe(2)

        store.dispatch('PATTERN_11')
        expect(getEpicState(store, epic1).counter).toBe(3)
        expect(getEpicState(store, epic2).counter).toBe(1)
        expect(getEpicState(store, epic3).counter).toBe(1)
        expect(getEpicState(store, epic4).counter).toBe(3)

        store.dispatch('BPATTERN_11')
        expect(getEpicState(store, epic1).counter).toBe(3)
        expect(getEpicState(store, epic2).counter).toBe(1)
        expect(getEpicState(store, epic3).counter).toBe(1)
        expect(getEpicState(store, epic4).counter).toBe(4)

        store.dispatch('PBTTERN_1')
        expect(getEpicState(store, epic1).counter).toBe(3)
        expect(getEpicState(store, epic2).counter).toBe(1)
        expect(getEpicState(store, epic3).counter).toBe(1)
        expect(getEpicState(store, epic4).counter).toBe(4)

        store.dispatch('PATTERN_')
        expect(getEpicState(store, epic1).counter).toBe(4)
        expect(getEpicState(store, epic2).counter).toBe(1)
        expect(getEpicState(store, epic3).counter).toBe(1)
        expect(getEpicState(store, epic4).counter).toBe(5)
    })

    it('Pattern conditions should function simillar to other conditions', function () {
        const epic1 = makeEpic()
        const epic2 = makeEpic()
        const epic3 = makeEpic()
        const action = makeAction()

        store.register(makeCounterEpic(epic1, ['PATTERN_*', readonly(action)]))
        store.register(makeCounterEpic(epic2, ['PATTERN_*', action]))
        store.register(makeCounterEpic(epic3, [anyOf('PATTERN_*', action)]))

        expect(getEpicState(store, epic1).counter).toBe(undefined)
        expect(getEpicState(store, epic2).counter).toBe(undefined)
        expect(getEpicState(store, epic3).counter).toBe(undefined)

        store.dispatch('PATTERN_1')
        expect(getEpicState(store, epic1).counter).toBe(1)
        expect(getEpicState(store, epic2).counter).toBe(undefined)
        expect(getEpicState(store, epic3).counter).toBe(1)

        store.dispatch(action)
        expect(getEpicState(store, epic1).counter).toBe(1)
        expect(getEpicState(store, epic2).counter).toBe(undefined)
        expect(getEpicState(store, epic3).counter).toBe(2)
    })
})

describe('Pattern Listeners: ', function () {
    it('Epic listener with a pattern condition should work as expected', function () {
        const epic = makeEpic()
        const action1 = makeAction()
        const action2 = makeAction()
        const action3 = makeAction()
        const listenerSpy1 = jasmine.createSpy('listener1')
        const listenerSpy2 = jasmine.createSpy('listener2')

        store.register(makeCounterEpic('B_PATTERN_1', [readonly(action1), action2]))
        store.register(makeCounterEpic('B_PATTERN_2', [action1, action2]))
        store.register(makeCounterEpic('B_PATTERN_3', [anyOf(action1, action2)]))
        store.register(makeCounterEpic(epic, [anyOf(action2, action3)]))

        store.addListener(resolve(['B_PATTERN_*', epic]), listenerSpy1)
        store.addListener(resolve(['B_PATTERN_*', readonly(epic)]), listenerSpy2)

        store.dispatch(action1)
        expect(listenerSpy1).toHaveBeenCalledTimes(1)
        expect(listenerSpy2).toHaveBeenCalledTimes(1)

        store.dispatch(action2)
        expect(listenerSpy1).toHaveBeenCalledTimes(2)
        expect(listenerSpy2).toHaveBeenCalledTimes(2)

        store.dispatch(action3)
        expect(listenerSpy1).toHaveBeenCalledTimes(3)
        expect(listenerSpy2).toHaveBeenCalledTimes(2)
    })
})
