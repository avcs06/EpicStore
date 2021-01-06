import { createStore } from '../../src'
import { getEpicScope, getEpicState } from '../../src/store'
import { makeEpic, makeAction, makeCounterEpic } from '../helpers/makeEpic'
const store = createStore()

describe('Side Effects: ', function () {
    it('Should update epic state on action', function () {
        const epic = makeEpic()
        const action = makeAction()
        store.register(makeCounterEpic(epic, action))
        store.dispatch(action)
        expect(getEpicState(store, epic).counter).toBe(1)
        store.dispatch(action)
        expect(getEpicState(store, epic).counter).toBe(2)
    })

    it('Should update epic scope on action', function () {
        const epic = makeEpic()
        const action = makeAction()
        store.register(makeCounterEpic(epic, action))
        store.dispatch(action)
        expect(getEpicScope(store, epic).counter).toBe(1)
        store.dispatch(action)
        expect(getEpicScope(store, epic).counter).toBe(2)
    })

    /* it("Should dispatch actions if actions are returned", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const action1 = makeAction();
        const action2 = makeAction();

        store.register(makeCounterEpic(epic1, action1, {
            actionsToDispatch: [action2]
        }));
        store.register(makeCounterEpic(epic2, action2));

        expect(getEpicState(store, epic1).counter).toBe(0);
        expect(getEpicState(store, epic2).counter).toBe(0);
        store.dispatch(action1);
        expect(getEpicState(store, epic1).counter).toBe(1);
        expect(getEpicState(store, epic2).counter).toBe(1);
    }); */
})
