import EpicManager from '../../../src/EpicManager';
import { makeGetter, makeCounterEpic } from '../../helpers/makeEpic';

const make = makeGetter('selector');
const makeEpic = make('epic');
const makeAction = make('action');

describe("Condition Selector: ", function () {
    it("Should trigger handler only when the selector value changed", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const action = makeAction();
        EpicManager.register(makeCounterEpic(epic1, action));
        EpicManager.register(makeCounterEpic(epic2, {
            type: epic1,
            selector: ({ counter }) => Math.floor(counter / 3)
        }));

        for (let i = 0; i < 9; i++) EpicManager.dispatch(action);
        expect(EpicManager.getEpicState(epic1).counter).toBe(9);
        // epic 2 will be executed only when epic1 value is 1, 3, 6, 9
        expect(EpicManager.getEpicState(epic2).counter).toBe(4);
    });
});

describe("Condition with initial value: ", function () {
    it("Should trigger handler only when the selector value changed", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const action = makeAction();
        EpicManager.register(makeCounterEpic(epic1, action));
        EpicManager.register(makeCounterEpic(epic2, {
            type: epic1,
            value: 0,
            selector: ({ counter }) => Math.floor(counter / 3)
        }));

        for (let i = 0; i < 9; i++) EpicManager.dispatch(action);
        expect(EpicManager.getEpicState(epic1).counter).toBe(9);
        // epic 2 will be executed only when epic1 value is 3, 6, 9
        expect(EpicManager.getEpicState(epic2).counter).toBe(3);
    });
});
