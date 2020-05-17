import { Store, withSelector, withGuard, Epic, Condition, withPayload, resolve } from '../../../src';
import { makeEpic, makeAction, makeCounterEpic } from '../../helpers/makeEpic';
const EpicStore = new Store();

describe("Condition Selector: ", function () {
    it("Should trigger handler only when the selector value changed", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const action = makeAction();
        EpicStore.register(makeCounterEpic(epic1, action));
        EpicStore.register(makeCounterEpic(epic2, withSelector(epic1, ({ counter }) => Math.floor(counter / 3))));

        for (let i = 0; i < 9; i++) EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic1).counter).toBe(9);
        // epic 2 will be executed only when epic1 value is changed to 3, 6, 9 for first time
        expect(EpicStore.getEpicState(epic2).counter).toBe(3);
    });
});

describe("Condition Guard: ", function () {
    it("Should trigger handler only when the guard value returns true", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const action = makeAction();
        EpicStore.register(makeCounterEpic(epic1, action));
        EpicStore.register(makeCounterEpic(epic2, withGuard(epic1, ({ counter }) => counter > 3)));

        for (let i = 0; i < 5; i++) EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic1).counter).toBe(5);
        // epic 2 will be executed only when epic1 value is changed to 4, 5
        expect(EpicStore.getEpicState(epic2).counter).toBe(2);
    });
});

describe("Condition Value: ", function () {
    it("Should execute epic handler if the condition value didnt change, and the action is external", function () {
        const epic = makeEpic();
        const action = makeAction();
        const valueSymbol = Symbol('value');

        EpicStore.register(makeCounterEpic(epic, action));
        expect(EpicStore.getEpicState(epic).counter).toBe(0);

        for (let i = 0; i < 5; i++) EpicStore.dispatch(withPayload(action, valueSymbol));
        expect(EpicStore.getEpicState(epic).counter).toBe(5);
    });

    it("Should not execute epic handler if the condition value didnt change, and the action is internal", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const action = makeAction();

        const epic = new Epic(epic1, { counter1: 0, counter2: 0 }, null);
        epic.on(resolve({ action }), function ({ action }) {
            expect(action).toBe('avcs');
            return { state: { counter1: this.state.counter1 + 1 } };
        });
        EpicStore.register(epic);
        EpicStore.register(makeCounterEpic(epic2, new Condition(epic, { selector: ({ counter2 }) => counter2 })));

        EpicStore.dispatch(withPayload(action, 'avcs'));
        expect(EpicStore.getEpicState(epic1).counter1).toBe(1);
        // epic1 is an internal action and condition value not changed
        expect(EpicStore.getEpicState(epic2).counter).toBe(0);
    });

    it("Condition value should be updated and not reset even if the condition not met", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const epic3 = makeEpic();
        const action1 = makeAction();
        const action2 = makeAction();
        const action3 = makeAction();

        let epic;
        EpicStore.register(epic = makeCounterEpic(epic1, action1));
        EpicStore.register(makeCounterEpic(epic2, action2));
        EpicStore.register(makeCounterEpic(epic3, [action3, epic2, epic]));

        EpicStore.dispatch(action1);
        // Handler should not be executed
        expect(EpicStore.getEpicState(epic3).counter).toBe(0);
        // Met condition should be updated event if the handler is not executed
        expect(EpicStore._getUpdaterConditions(epic3, 'Listener[0]')[2].value.counter).toBe(1);

        EpicStore.dispatch(action2);
        // Handler should not be executed
        expect(EpicStore.getEpicState(epic3).counter).toBe(0);
        // Unmet condition should not get reset
        expect(EpicStore._getUpdaterConditions(epic3, 'Listener[0]')[2].value.counter).toBe(1);
    });
});
