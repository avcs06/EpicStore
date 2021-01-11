/* eslint-disable @typescript-eslint/no-empty-function */
import { createStore, resolve, readonly, anyOf, makeEpic as makeOriginalEpic } from '../../src'
import { ErrorMessages, makeError } from '../../src/errors'
import { makeEpic, makeAction, makeCounterEpic } from '../helpers/makeEpic'
const store = createStore()

const invariantError = message => {
    const error = new Error(message)
    error.name = 'Invariant Violation'
    return error
}

describe('Invalid Entries: should throw error', function () {
    it('on duplicate epic name', function () {
        const epic1 = makeEpic()
        const errorMessage = makeError(epic1).get(ErrorMessages.duplicateEpic)

        store.register(makeOriginalEpic(epic1))

        expect(() => {
            store.register(makeOriginalEpic(epic1))
        }).toThrow(invariantError(errorMessage))
    })

    it('on all readonly conditions', function () {
        const epic = makeOriginalEpic(makeEpic())
        epic.useReducer(resolve([readonly(makeAction()), readonly(makeAction())]), () => {})
        const errorMessage = makeError(epic.name, 'R[0]').get(ErrorMessages.noReadonlyUpdaters)

        expect(() => {
            store.register(epic)
        }).toThrow(invariantError(errorMessage))
    })

    it('on readonly pattern condition', function () {
        const epic = makeOriginalEpic(makeEpic())
        epic.useReducer(resolve([readonly('PATTERN_*')]), () => {})
        const errorMessage = makeError(epic.name, 'R[0]').get(ErrorMessages.invalidPattern)

        expect(() => {
            store.register(epic)
        }).toThrow(invariantError(errorMessage))
    })

    it('on readonly anyof condition', function () {
        const epic = makeOriginalEpic(makeEpic())
        epic.useReducer(resolve([anyOf(readonly(makeAction()))]), () => { })
        const errorMessage = makeError(epic.name, 'R[0]').get(ErrorMessages.invalidAnyOf)

        expect(() => {
            store.register(epic)
        }).toThrow(invariantError(errorMessage))
    })

    it('on any pattern anyof condition', function () {
        const epic = makeOriginalEpic(makeEpic())
        epic.useReducer(resolve([anyOf('*')]), () => { })
        const errorMessage = makeError(epic.name, 'R[0]').get(ErrorMessages.invalidAnyOf)

        expect(() => {
            store.register(epic)
        }).toThrow(invariantError(errorMessage))
    })

    it('on dispatching inside epic listener', function () {
        const action1 = makeAction()
        const epic = makeOriginalEpic(makeEpic())
        epic.useReducer(action1, () => ({
            state: { counter: epic.state.counter + 1 }
        }))

        store.register(epic)
        store.addListener(epic.name, function epicListener1 () {
            store.dispatch({ type: 'INVALID_ACTION_1' })
        })

        expect(() => {
            store.dispatch(action1)
        }).toThrow([invariantError(makeError('epicListener1').get(ErrorMessages.noDispatchInEpicListener))])
    })

    it('on dispatching inside epic handler', function () {
        const action1 = makeAction()
        const epic = makeOriginalEpic(makeEpic())
        epic.useReducer(action1, function epicHandler1 () {
            store.dispatch(makeAction())

            return {
                state: { counter: epic.state.counter + 1 }
            }
        })

        store.register(epic)
        expect(() => {
            store.dispatch(action1)
        }).toThrow(invariantError(makeError(epic.name, 'epicHandler1').get(ErrorMessages.noDispatchInEpicUpdater)))
    })

    it('on changing state type', function () {
        const epic = makeOriginalEpic(makeEpic())
        const action1 = makeAction()
        const action2 = makeAction()

        epic.useReducer(action1, () => ({ state: 'asdf' }))
        epic.useReducer(action2, () => ({ state: { a: 2 } }))

        store.register(epic)
        store.dispatch(action1)

        expect(() => {
            store.dispatch(action2)
        }).toThrow(invariantError(makeError(epic.name, 'R[1]').get(ErrorMessages.invalidHandlerUpdate)))
    })

    it('on epic as external action', function () {
        const epic1 = makeEpic()
        const epic2 = makeEpic()
        const action = makeAction()
        store.register(makeCounterEpic(epic1, action))
        store.register(makeCounterEpic(epic2, action))
        expect(() => {
            store.dispatch(epic1)
        }).toThrow(invariantError(makeError(epic1).get(ErrorMessages.invalidEpicAction)))
    })

    it('on multiple initial set state', function () {
        const epic = makeEpic()
        const action = makeAction()
        const counterEpic = makeCounterEpic(epic, action, { state: { counter: 0 } })
        store.register(counterEpic)

        expect(() => {
            counterEpic.useState(null)
        }).toThrow(invariantError(makeError(epic).get(ErrorMessages.invalidMultipleSetState)))
    })

    it('on multiple initial set scope', function () {
        const epic = makeEpic()
        const action = makeAction()
        const counterEpic = makeCounterEpic(epic, action, { scope: { counter: 0 } })
        store.register(counterEpic)

        expect(() => {
            counterEpic.useScope(null)
        }).toThrow(invariantError(makeError(epic).get(ErrorMessages.invalidMultipleSetScope)))
    })

    /* it("on cyclic external action", function () {
    const epic = makeEpic();
    const action = makeAction();

    store.register(makeCounterEpic(epic, action, {
      actionsToDispatch: [action] }));

    expect(() => {
      store.dispatch(action);
    }).toThrow(invariantError(makeError(action).get(ErrorMessages.noRepeatedExternalAction)));
  }); */
})
