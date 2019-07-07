import EpicManager from '../../src/EpicManager';
import { makeGetter, makeCounterEpic } from '../helpers/makeEpic';

const make = makeGetter('basic');
const makeEpic = make('epic');
const makeAction = make('action');

describe("Basic functionalities", function() {
    it("Should update epic state on action", function() {
        const epic = makeEpic();
        const action = makeAction();
        EpicManager.register(makeCounterEpic(epic, action));
        expect(EpicManager.getEpicState(epic).counter).toBe(0);
        EpicManager.dispatch(action);
        expect(EpicManager.getEpicState(epic).counter).toBe(1);
        EpicManager.dispatch(action);
        expect(EpicManager.getEpicState(epic).counter).toBe(2);
    });

    it("Should unregister epic", function () {
        const epic = makeEpic();
        const action = makeAction();
        const verify = jasmine.createSpy('verify');
        EpicManager.register(makeCounterEpic(epic, action, { verify }));

        expect(EpicManager.getEpicState(epic).counter).toBe(0);
        EpicManager.unregister(epic);
        expect(EpicManager.getEpicState(epic)).toBe(null);
        EpicManager.dispatch(action);
        expect(verify).not.toHaveBeenCalled();
    });


    it("Should dispatch epic action on epic state update", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const action = makeAction();
        EpicManager.register(makeCounterEpic(epic1, action));
        EpicManager.register(makeCounterEpic(epic2, epic1));
        expect(EpicManager.getEpicState(epic1).counter).toBe(0);
        expect(EpicManager.getEpicState(epic2).counter).toBe(0);
        EpicManager.dispatch(action);
        expect(EpicManager.getEpicState(epic1).counter).toBe(1);
        expect(EpicManager.getEpicState(epic2).counter).toBe(1);
    });

    it("Should revert state, scope and condition to previous state on error", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const action = makeAction();
        const additionalParams = {};
        EpicManager.register(makeCounterEpic(epic1, action));
        EpicManager.register(makeCounterEpic(epic2, epic1, additionalParams));
        expect(EpicManager.getEpicState(epic1).counter).toBe(0);
        expect(EpicManager.getEpicScope(epic1).counter).toBe(0);

        EpicManager.dispatch(action);
        expect(EpicManager.getEpicState(epic1).counter).toBe(1);
        expect(EpicManager.getEpicScope(epic1).counter).toBe(1);
        expect(EpicManager.getEpicUpdaters(epic2, 0).conditions[0].value.counter).toBe(1);

        additionalParams.withError = true;
        expect(() => EpicManager.dispatch(action)).toThrow();
        expect(EpicManager.getEpicState(epic1).counter).toBe(1);
        expect(EpicManager.getEpicScope(epic1).counter).toBe(1);
        expect(EpicManager.getEpicUpdaters(epic2, 0).conditions[0].value.counter).toBe(1);

        additionalParams.withError = false;
        EpicManager.dispatch(action);
        expect(EpicManager.getEpicState(epic1).counter).toBe(2);
        expect(EpicManager.getEpicScope(epic1).counter).toBe(2);
        expect(EpicManager.getEpicUpdaters(epic2, 0).conditions[0].value.counter).toBe(2);
    });
});
