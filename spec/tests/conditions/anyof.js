import EpicManager from '../../../src/EpicManager';
import { makeGetter, makeCounterEpic } from '../../helpers/makeEpic';

const makeAnyof = makeGetter('anyof');
const makeAnyofEpic = makeAnyof('epic');
const makeAnyofAction = makeAnyof('action');

describe("AnyOf conditions: ", function() {
    it("Should receive two values only in conditionValues", function() {
        const activeAction = makeAnyofAction();
        makeCounterEpic(makeAnyofEpic(), activeAction, {
            extraConditions: [[{ type: makeAnyofAction(), passive: true }, { type: makeAnyofAction(), optional: true }]],
            verify: (conditions, { currentAction }) => {
                expect(conditions.length).toBe(2);
                expect(currentAction.type).toBe(activeAction);
            }
        });

        EpicManager.dispatch(activeAction);
    });


    it("Should update state on anyOf the actions", function() {
        const activeEpic = makeAnyofEpic();
        const anyOfAction1 = makeAnyofAction();
        const anyOfAction2= makeAnyofAction();
        makeCounterEpic(activeEpic, null, {
            extraConditions: [
                [{ type: anyOfAction1 }, { type: anyOfAction2 }],
                { type: makeAnyofAction(), optional: true },
                { type: makeAnyofAction(), passive: true },
            ]
        });

        expect(EpicManager.getEpicState(activeEpic).counter).toBe(0);
        EpicManager.dispatch(anyOfAction1);
        expect(EpicManager.getEpicState(activeEpic).counter).toBe(1);
        EpicManager.dispatch(anyOfAction2);
        expect(EpicManager.getEpicState(activeEpic).counter).toBe(2);
    });
});
