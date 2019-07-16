import { createStore } from '../../../src/EpicStore';
import { makeGetter, makeCounterEpic } from '../../helpers/makeEpic';
import { withSelector } from '../../../src/Condition';

const make = makeGetter('selector');
const makeEpic = make('epic');
const makeAction = make('action');
const EpicStore = createStore(true);

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

describe("Condition with initial value: ", function () {
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
});
