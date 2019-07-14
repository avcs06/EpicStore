import EpicManager from '../../src/EpicManager';
import { makeGetter, makeCounterEpic } from '../helpers/makeEpic';

const make = makeGetter('sideeffects');
const makeEpic = make('epic');
const makeAction = make('action');

describe("Side Effects: ", function () {
    it("Should update epic state on action", function () {
        const epic = makeEpic();
        const action = makeAction();
        EpicManager.register(makeCounterEpic(epic, action));
        expect(EpicManager.getEpicState(epic).counter).toBe(0);
        EpicManager.dispatch(action);
        expect(EpicManager.getEpicState(epic).counter).toBe(1);
        EpicManager.dispatch(action);
        expect(EpicManager.getEpicState(epic).counter).toBe(2);
    });

    it("Should update epic scope on action", function () {
        const epic = makeEpic();
        const action = makeAction();
        EpicManager.register(makeCounterEpic(epic, action));
        expect(EpicManager.getEpicScope(epic).counter).toBe(0);
        EpicManager.dispatch(action);
        expect(EpicManager.getEpicScope(epic).counter).toBe(1);
        EpicManager.dispatch(action);
        expect(EpicManager.getEpicScope(epic).counter).toBe(2);
    });

    it("Should dispatch actions if actions are returned", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const action1 = makeAction();
        const action2 = makeAction();

        EpicManager.register(makeCounterEpic(epic1, action1, {
            actionsToDispatch: [action2]
        }));
        EpicManager.register(makeCounterEpic(epic2, action2));

        expect(EpicManager.getEpicState(epic1).counter).toBe(0);
        expect(EpicManager.getEpicState(epic2).counter).toBe(0);
        EpicManager.dispatch(action1);
        expect(EpicManager.getEpicState(epic1).counter).toBe(1);
        expect(EpicManager.getEpicState(epic2).counter).toBe(1);
    });

    it("Should dispatch actions inside the updater", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const action1 = makeAction();
        const action2 = makeAction();

        EpicManager.register(makeCounterEpic(epic1, action1, {
            verify: () => EpicManager.dispatch(action2)
        }));
        EpicManager.register(makeCounterEpic(epic2, [epic1, action2]));

        expect(EpicManager.getEpicState(epic1).counter).toBe(0);
        expect(EpicManager.getEpicState(epic2).counter).toBe(0);
        EpicManager.dispatch(action1);
        expect(EpicManager.getEpicState(epic1).counter).toBe(1);
        expect(EpicManager.getEpicState(epic2).counter).toBe(1);
    });
});
