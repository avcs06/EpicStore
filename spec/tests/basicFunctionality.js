
import Action from '../../src/Action';
import { createStore } from '../../src/EpicStore';
import Condition from '../../src/Condition';
import { makeEpic, makeAction, makeCounterEpic } from '../helpers/makeEpic';
import Epic from '../../src/Epic';
import Updater from '../../src/Updater';
const EpicStore = createStore({ debug: true });

describe("Basic functionalities", function() {
    it("Should update epic state and scope on action", function() {
        const epic = makeEpic();
        const action = makeAction();
        EpicStore.register(makeCounterEpic(epic, new Condition(action)));
        expect(EpicStore.getEpicState(epic).counter).toBe(0);
        expect(EpicStore.getEpicScope(epic).counter).toBe(0);

        EpicStore.dispatch(new Action(action));
        expect(EpicStore.getEpicState(epic).counter).toBe(1);
        expect(EpicStore.getEpicScope(epic).counter).toBe(1);

        EpicStore.dispatch(new Action(action));
        expect(EpicStore.getEpicState(epic).counter).toBe(2);
        expect(EpicStore.getEpicScope(epic).counter).toBe(2);
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

    it('Epic listener condition value should get updated, even if the listerner throws an error', function () {
        const epic = makeEpic();
        const action = makeAction();

        EpicStore.register(makeCounterEpic(epic, action));
        EpicStore.addListener([epic], () => { throw 'Fake Error'; });

        expect(EpicStore.getEpicListeners(epic)[0].conditions[0].value, undefined);
        expect(() => EpicStore.dispatch(action)).toThrow(['Fake Error']);
        expect(EpicStore.getEpicListeners(epic)[0].conditions[0].value.counter, 1);
    });

    it('Should not dispatch epic action on passive update', function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const action = makeAction();

        EpicStore.register(new Epic(epic1, {}, null, [
            new Updater([action], () => ({
                state: { a: 1 },
                passive: true
            }))
        ]));
        EpicStore.register(makeCounterEpic(epic2, epic1));

        EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic2).counter).toBe(0);
    });
});
