
import { Store, Condition, Epic, Action } from '../../src';
import { makeEpic, makeAction, makeCounterEpic } from '../helpers/makeEpic';
const EpicStore = new Store();

fdescribe("Basic functionalities", function() {
    it("Should update epic state and scope on action", function() {
        const epic = makeEpic();
        const action = makeAction();
        EpicStore.register(makeCounterEpic(epic, new Condition(action)));
        expect(EpicStore.getEpicState(epic).counter).toBe(0);
        expect(EpicStore.getEpicScope(epic).counter).toBe(0);

        EpicStore.dispatch(new Action(action));
        expect(EpicStore.getEpicState(epic).counter).toBe(1);
        expect(EpicStore.getEpicScope(epic).counter).toBe(1);

        EpicStore.dispatch(action);
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

    it("Unregister should handle non existant epic gracefully", function () {
        expect(() => EpicStore.unregister('AVCS')).not.toThrow();
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
        const additionalParams: any = {};
        EpicStore.register(makeCounterEpic(epic1, action));
        EpicStore.register(makeCounterEpic(epic2, epic1, additionalParams));
        expect(EpicStore.getEpicState(epic1).counter).toBe(0);
        expect(EpicStore.getEpicScope(epic2).counter).toBe(0);

        EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic1).counter).toBe(1);
        expect(EpicStore.getEpicScope(epic2).counter).toBe(1);
        expect(EpicStore._getUpdaterConditions(epic2, 'Listener[0]')[0].value.counter).toBe(1);

        additionalParams.withError = true;
        expect(() => EpicStore.dispatch(action)).toThrow();
        expect(EpicStore.getEpicState(epic1).counter).toBe(1);
        expect(EpicStore.getEpicScope(epic2).counter).toBe(1);
        expect(EpicStore._getUpdaterConditions(epic2, 'Listener[0]')[0].value.counter).toBe(1);

        additionalParams.withError = false;
        EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic1).counter).toBe(2);
        expect(EpicStore.getEpicScope(epic2).counter).toBe(2);
        expect(EpicStore._getUpdaterConditions(epic2, 'Listener[0]')[0].value.counter).toBe(2);
    });

    it('Epic listener condition value should get updated, even if the listerner throws an error', function () {
        const epic = makeEpic();
        const action = makeAction();

        EpicStore.register(makeCounterEpic(epic, action));
        EpicStore.on(epic, () => { throw 'Fake Error'; });

        (expect as any)(EpicStore.getStoreListeners(epic)[0].conditions[0].value, undefined);
        (expect as any)(() => EpicStore.dispatch(action)).toThrow(['Fake Error']);
        (expect as any)(EpicStore.getStoreListeners(epic)[0].conditions[0].value.counter, 1);
    });

    it('Should not dispatch epic action on passive update', function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const action = makeAction();

        const epic = new Epic(epic1, {}, null);
        EpicStore.register(epic);
        epic.on(action, () => ({
            state: { a: 1 },
            passive: true
        }));

        EpicStore.register(makeCounterEpic(epic2, epic1));
        EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic2).counter).toBe(0);
    });
});
