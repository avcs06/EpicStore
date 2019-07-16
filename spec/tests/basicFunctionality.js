
import Action from '../../src/Action';
import { createStore } from '../../src/EpicStore';
import { makeGetter, makeCounterEpic } from '../helpers/makeEpic';

const make = makeGetter('basic');
const makeEpic = make('epic');
const makeAction = make('action');
const EpicStore = createStore(true);

describe("Basic functionalities", function() {
    it("Should update epic state on action", function() {
        const epic = makeEpic();
        const action = makeAction();
        EpicStore.register(makeCounterEpic(epic, action));
        expect(EpicStore.getEpicState(epic).counter).toBe(0);
        EpicStore.dispatch(new Action(action));
        expect(EpicStore.getEpicState(epic).counter).toBe(1);
        EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic).counter).toBe(2);
    });

    it("Should unregister epic", function () {
        const epic = makeEpic();
        const action = makeAction();
        const verify = jasmine.createSpy('verify');
        EpicStore.register(makeCounterEpic(epic, action, { verify }));

        expect(EpicStore.getEpicState(epic).counter).toBe(0);
        EpicStore.unregister(epic);
        expect(EpicStore.getEpicState(epic)).toBe(null);
        EpicStore.dispatch(action);
        expect(verify).not.toHaveBeenCalled();
    });


    it("Should dispatch epic action on epic state update", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const action = makeAction();
        EpicStore.register(makeCounterEpic(epic1, action));
        EpicStore.register(makeCounterEpic(epic2, epic1));
        expect(EpicStore.getEpicState(epic1).counter).toBe(0);
        expect(EpicStore.getEpicState(epic2).counter).toBe(0);
        EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic1).counter).toBe(1);
        expect(EpicStore.getEpicState(epic2).counter).toBe(1);
    });

    it("Should revert state, scope and condition to previous state on error", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const action = makeAction();
        const additionalParams = {};
        EpicStore.register(makeCounterEpic(epic1, action));
        EpicStore.register(makeCounterEpic(epic2, epic1, additionalParams));
        expect(EpicStore.getEpicState(epic1).counter).toBe(0);
        expect(EpicStore.getEpicScope(epic1).counter).toBe(0);

        EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic1).counter).toBe(1);
        expect(EpicStore.getEpicScope(epic1).counter).toBe(1);
        expect(EpicStore.getEpicUpdaters(epic2, 0)[0].conditions[0].value.counter).toBe(1);

        additionalParams.withError = true;
        expect(() => EpicStore.dispatch(action)).toThrow();
        expect(EpicStore.getEpicState(epic1).counter).toBe(1);
        expect(EpicStore.getEpicScope(epic1).counter).toBe(1);
        expect(EpicStore.getEpicUpdaters(epic2, 0)[0].conditions[0].value.counter).toBe(1);

        additionalParams.withError = false;
        EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic1).counter).toBe(2);
        expect(EpicStore.getEpicScope(epic1).counter).toBe(2);
        expect(EpicStore.getEpicUpdaters(epic2, 0)[0].conditions[0].value.counter).toBe(2);
    });
});
