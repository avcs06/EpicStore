import { createStore } from '../../../src/EpicStore';
import { makeEpic, makeAction, makeCounterEpic } from '../../helpers/makeEpic';
import { withSelector, withValue, required } from '../../../src/Condition';
import Epic from '../../../src/Epic';
import Action from '../../../src/Action';
import Updater from '../../../src/Updater';
const EpicStore = createStore({ debug: true });

describe("Condition Selector: ", function () {
    it("Should trigger handler only when the selector value changed", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const action = makeAction();
        EpicStore.register(makeCounterEpic(epic1, action));
        EpicStore.register(makeCounterEpic(epic2, withSelector(epic1, ({ counter }) => Math.floor(counter / 3))));

        for (let i = 0; i < 9; i++) EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic1).counter).toBe(9);
        // epic 2 will be executed only when epic1 value is 1, 3, 6, 9
        expect(EpicStore.getEpicState(epic2).counter).toBe(4);
    });
});

describe("Condition Value: ", function () {
    it("Should trigger handler only when the selector value changed", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const action = makeAction();
        EpicStore.register(makeCounterEpic(epic1, action));
        EpicStore.register(makeCounterEpic(epic2, {
            type: epic1,
            value: 0,
            selector: ({ counter }) => Math.floor(counter / 3)
        }));

        for (let i = 0; i < 9; i++) EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic1).counter).toBe(9);
        // epic 2 will be executed only when epic1 value is 3, 6, 9
        expect(EpicStore.getEpicState(epic2).counter).toBe(3);
    });

    it("Should execute epic handler if the condition value didnt change, and the action is external", function () {
        const epic = makeEpic();
        const action = makeAction();
        const valueSymbol = Symbol('value');

        EpicStore.register(makeCounterEpic(epic, withValue(action, valueSymbol)));
        expect(EpicStore.getEpicState(epic).counter).toBe(0);

        EpicStore.dispatch(new Action(action, valueSymbol));
        expect(EpicStore.getEpicState(epic).counter).toBe(1);
    });

    it("Should not execute epic handler if the condition value didnt change, and the action is internal", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const epic3 = makeEpic();
        const action = makeAction();

        EpicStore.register(new Epic(epic1, { counter1: 0, counter2: 0 }, null, [
            new Updater([action], ($0, { state }) => ({ state: { counter1: state.counter1 + 1 } }))
        ]));
        EpicStore.register(makeCounterEpic(epic2, withSelector(epic1, ({ counter2 }) => counter2)));
        EpicStore.register(makeCounterEpic(epic3, withSelector(withValue(epic1, 0), ({ counter2 }) => counter2)));

        EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic1).counter1).toBe(1);
        // epic1 is an internal action and condition value changed as there is no initial condition value
        expect(EpicStore.getEpicState(epic2).counter).toBe(1);
        // epic1 is an internal action and condition value not changed
        expect(EpicStore.getEpicState(epic3).counter).toBe(0);

        EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic1).counter1).toBe(2);
        // epic1 is an internal action and condition value not changed
        expect(EpicStore.getEpicState(epic2).counter).toBe(1);
        // epic1 is an internal action and condition value not changed
        expect(EpicStore.getEpicState(epic3).counter).toBe(0);
    });

    it("Condition value should be updated and not reset even if the condition not met", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const action1 = makeAction();
        const action2 = makeAction();

        EpicStore.register(makeCounterEpic(epic1, action1));
        EpicStore.register(makeCounterEpic(epic2, [required(withValue(action2, 1)), epic1]));

        EpicStore.dispatch(action1);
        // Handler should not be executed
        expect(EpicStore.getEpicState(epic2).counter).toBe(0);
        // Unmet condition should not get reset
        expect(EpicStore.getEpicUpdaters(epic2, 0)[0].conditions[0].value).toBe(1);
        // Met condition should be updated event if the handler is not executed
        expect(EpicStore.getEpicUpdaters(epic2, 0)[0].conditions[1].value.counter).toBe(1);
    });
});
