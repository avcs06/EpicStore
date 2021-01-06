import { readonly, resolve, createStore } from '../../src'
import { makeEpic, makeAction, makeCounterEpic } from '../helpers/makeEpic'
const store = createStore()
const error = new Error('Fake Error')

describe('Epic Listeners: ', function () {
    it('Should trigger epic listener with proper params', function () {
        const epic = makeEpic()
        const action = makeAction()
        const listenerSpy = jasmine.createSpy('listener')

        store.register(makeCounterEpic(epic, action))
        store.addListener(epic, listenerSpy)
        store.dispatch(action)
        expect(listenerSpy).toHaveBeenCalledWith({ counter: 1 }, { type: action })
    })

    it('Should not trigger epic listener multiple times', function () {
        const epic1 = makeEpic()
        const epic2 = makeEpic()
        const action = makeAction()
        const listenerSpy = jasmine.createSpy('listener')

        store.register(makeCounterEpic(epic1, action))
        store.register(makeCounterEpic(epic2, action))
        store.addListener(resolve([epic1, epic2]), listenerSpy)
        store.dispatch(action)

        expect(listenerSpy).toHaveBeenCalledTimes(1)
        expect(listenerSpy).toHaveBeenCalledWith([{ counter: 1 }, { counter: 1 }], { type: action })
    })

    it('removeListener should function as expected', function () {
        const epic1 = makeEpic()
        const epic2 = makeEpic()
        const action = makeAction()
        const listenerSpy = jasmine.createSpy('listener')

        store.register(makeCounterEpic(epic1, action))
        store.register(makeCounterEpic(epic2, action))

        const removeListener = store.addListener(resolve([epic1, epic2]), listenerSpy)
        removeListener()

        store.dispatch(action)
        expect(listenerSpy).not.toHaveBeenCalled()
    })

    it('Epic listener should not be triggered if none of the conditions changed', function () {
        const epic1 = makeEpic()
        const epic2 = makeEpic()
        const epic3 = makeEpic()
        const action1 = makeAction()
        const action2 = makeAction()
        const listenerSpy = jasmine.createSpy('listener')

        store.register(makeCounterEpic(epic1, action1))
        store.register(makeCounterEpic(epic2, action1))
        store.register(makeCounterEpic(epic3, action2))
        store.addListener(resolve([epic1, epic2]), listenerSpy)

        store.dispatch(action2)
        expect(listenerSpy).not.toHaveBeenCalled()

        store.dispatch(action1)
        expect(listenerSpy).toHaveBeenCalled()
    })

    it('Readonly condition change should not trigger listener', function () {
        const epic1 = makeEpic()
        const epic2 = makeEpic()
        const action1 = makeAction()
        const action2 = makeAction()
        const listenerSpy = jasmine.createSpy('listener')

        store.register(makeCounterEpic(epic1, action1))
        store.register(makeCounterEpic(epic2, action2))
        store.addListener(resolve([readonly(epic1), epic2]), listenerSpy)

        store.dispatch(action1)
        expect(listenerSpy).not.toHaveBeenCalled()

        store.dispatch(action2)
        expect(listenerSpy).toHaveBeenCalled()
    })

    it('Epic listener should be triggered if atleast one condition is met', function () {
        const epic1 = makeEpic()
        const epic2 = makeEpic()
        const action1 = makeAction()
        const action2 = makeAction()
        const listenerSpy = jasmine.createSpy('listener')

        store.register(makeCounterEpic(epic1, action1))
        store.register(makeCounterEpic(epic2, action2))
        store.addListener(resolve([epic1, epic2]), listenerSpy)

        store.dispatch(action1)
        expect(listenerSpy).toHaveBeenCalled()

        store.dispatch(action2)
        expect(listenerSpy).toHaveBeenCalled()
    })

    it('If some of the listeners throw error, the successful listeners should still be executed', function () {
        const epic = makeEpic()
        const action = makeAction()
        const listenerSpy1 = jasmine.createSpy('listener1')
        const listenerSpy2 = jasmine.createSpy('listener2')

        store.register(makeCounterEpic(epic, action))
        store.addListener(epic, function () { throw error })
        store.addListener(epic, listenerSpy1)
        store.addListener(epic, function () { throw error })
        store.addListener(epic, listenerSpy2)

        expect(() => store.dispatch(action)).toThrow([error, error])
        expect(listenerSpy1).toHaveBeenCalled()
        expect(listenerSpy2).toHaveBeenCalled()
    })

    it('Removing multiple epic listeners should not throw error', function () {
        const epic = makeEpic()
        const action = makeAction()
        const listenerSpy1 = jasmine.createSpy('listener1')
        const listenerSpy2 = jasmine.createSpy('listener2')

        store.register(makeCounterEpic(epic, action))
        const removeListener1 = store.addListener([epic], listenerSpy1)
        const removeListener2 = store.addListener([epic], listenerSpy2)
        removeListener1()
        expect(() => removeListener2()).not.toThrow()
    })
})
