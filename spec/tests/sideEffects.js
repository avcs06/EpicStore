import { createStore } from '../../src/EpicStore';
import { makeEpic, makeAction, makeCounterEpic } from '../helpers/makeEpic';
const EpicStore = createStore(true);

describe("Side Effects: ", function () {
    it("Should update epic state on action", function () {
        const epic = makeEpic();
        const action = makeAction();
        EpicStore.register(makeCounterEpic(epic, action));
        expect(EpicStore.getEpicState(epic).counter).toBe(0);
        EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic).counter).toBe(1);
        EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic).counter).toBe(2);
    });

    it("Should update epic scope on action", function () {
        const epic = makeEpic();
        const action = makeAction();
        EpicStore.register(makeCounterEpic(epic, action));
        expect(EpicStore.getEpicScope(epic).counter).toBe(0);
        EpicStore.dispatch(action);
        expect(EpicStore.getEpicScope(epic).counter).toBe(1);
        EpicStore.dispatch(action);
        expect(EpicStore.getEpicScope(epic).counter).toBe(2);
    });

    it("Should dispatch actions if actions are returned", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const action1 = makeAction();
        const action2 = makeAction();

        EpicStore.register(makeCounterEpic(epic1, action1, {
            actionsToDispatch: [action2]
        }));
        EpicStore.register(makeCounterEpic(epic2, action2));

        expect(EpicStore.getEpicState(epic1).counter).toBe(0);
        expect(EpicStore.getEpicState(epic2).counter).toBe(0);
        EpicStore.dispatch(action1);
        expect(EpicStore.getEpicState(epic1).counter).toBe(1);
        expect(EpicStore.getEpicState(epic2).counter).toBe(1);
    });

    it("Should dispatch actions inside the updater", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const action1 = makeAction();
        const action2 = makeAction();

        EpicStore.register(makeCounterEpic(epic1, action1, {
            verify: () => EpicStore.dispatch(action2)
        }));
        EpicStore.register(makeCounterEpic(epic2, [epic1, action2]));

        expect(EpicStore.getEpicState(epic1).counter).toBe(0);
        expect(EpicStore.getEpicState(epic2).counter).toBe(0);
        EpicStore.dispatch(action1);
        expect(EpicStore.getEpicState(epic1).counter).toBe(1);
        expect(EpicStore.getEpicState(epic2).counter).toBe(1);
    });
});
