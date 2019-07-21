import { createStore } from '../../../src/EpicStore';
import { makeEpic, makeAction, makeCounterEpic } from '../../helpers/makeEpic';
import { anyOf } from '../../../src/Condition';
const EpicStore = createStore({ debug: true });

describe("AnyOf conditions: ", function() {
    it("Should receive two values only in conditionValues", function() {
        const action1 = makeAction();
        const action2 = makeAction();
        const action3 = makeAction();
        EpicStore.register(makeCounterEpic(makeEpic(), action1, {
            extraConditions: [[action2, action3]],
            verify: (conditions, { currentAction }) => {
                expect(conditions.length).toBe(2);
                // Should provide proper action as currentAction
                expect(currentAction.type).toBe(action2);
            }
        }));

        EpicStore.dispatch(action2);
    });

    it("Should update state on anyOf the actions", function() {
        const activeEpic = makeEpic();
        const anyOfAction1 = makeAction();
        const anyOfAction2= makeAction();
        EpicStore.register(makeCounterEpic(activeEpic, makeAction(), {
            extraConditions: [anyOf(anyOfAction1, anyOfAction2)]
        }));

        expect(EpicStore.getEpicState(activeEpic).counter).toBe(0);
        EpicStore.dispatch(anyOfAction1);
        expect(EpicStore.getEpicState(activeEpic).counter).toBe(1);
        EpicStore.dispatch(anyOfAction2);
        expect(EpicStore.getEpicState(activeEpic).counter).toBe(2);
    });

    it("Should split properly when there are multiple anyOf", function () {
        const epic = makeEpic();
        EpicStore.register(makeCounterEpic(epic, [
            [makeAction(), makeAction()], // 1, 2
            [makeAction(), makeAction()], // 3, 4
            [makeAction(), makeAction()], // 5, 6
        ]));
        /**
          * 1, 3, 5
          * 1, 3, 6
          * 1, 4, 5
          * 1, 4, 6
          * 2, 3, 5
          * 2, 3, 6
          * 2, 4, 5
          * 2, 4, 6
          **/
        
        const updaters = EpicStore.getEpicUpdaters(epic, 0);
        expect(updaters.length).toBe(2 * 2 * 2);
    });
});
