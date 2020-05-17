import { Store, anyOf } from '../../../src';
import { splitNestedValues } from '../../../src/Store';
import { makeEpic, makeAction, makeCounterEpic } from '../../helpers/makeEpic';
const EpicStore = new Store();

describe("AnyOf conditions: ", function() {
    it("Should receive only one value in conditionValues per anyOf", function() {
        const action2 = makeAction();
        const action3 = makeAction();
        EpicStore.register(makeCounterEpic(makeEpic(), [anyOf(action2, action3)], {
            verify: conditions => {
                expect(conditions.length).toBe(1);
            }
        }));

        EpicStore.dispatch(action2);
    });

    it("Should update state on any of the actions", function() {
        const activeEpic = makeEpic();
        const anyOfAction1 = makeAction();
        const anyOfAction2= makeAction();
        EpicStore.register(makeCounterEpic(activeEpic, [anyOf(anyOfAction1, anyOfAction2)]));

        expect(EpicStore.getEpicState(activeEpic).counter).toBe(0);
        EpicStore.dispatch(anyOfAction1);
        expect(EpicStore.getEpicState(activeEpic).counter).toBe(1);
        EpicStore.dispatch(anyOfAction2);
        expect(EpicStore.getEpicState(activeEpic).counter).toBe(2);
    });

    it("Should split properly when there are multiple anyOf", function () {
        const splits = splitNestedValues([[1, 2], [3, 4], [5, 6]]);
        expect(splits.length).toBe(2 * 2 * 2);
        expect(splits).toEqual([
            [1, 3, 5],
            [1, 3, 6],
            [1, 4, 5],
            [1, 4, 6],
            [2, 3, 5],
            [2, 3, 6],
            [2, 4, 5],
            [2, 4, 6],
        ]);
    });
});
