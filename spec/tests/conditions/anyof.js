import EpicManager from '../../../src/EpicManager';
import { makeGetter, makeCounterEpic } from '../../helpers/makeEpic';

const make = makeGetter('anyof');
const makeEpic = make('epic');
const makeAction = make('action');

describe("AnyOf conditions: ", function() {
    it("Should receive two values only in conditionValues", function() {
        const activeAction = makeAction();
        EpicManager.register(makeCounterEpic(makeEpic(), activeAction, {
            extraConditions: [[{ type: makeAction(), passive: true }, { type: makeAction(), optional: true }]],
            verify: (conditions, { currentAction }) => {
                expect(conditions.length).toBe(2);
                expect(currentAction.type).toBe(activeAction);
            }
        }));

        EpicManager.dispatch(activeAction);
    });

    it("Should update state on anyOf the actions", function() {
        const activeEpic = makeEpic();
        const anyOfAction1 = makeAction();
        const anyOfAction2= makeAction();
        EpicManager.register(makeCounterEpic(activeEpic, null, {
            extraConditions: [
                EpicManager.anyOf({ type: anyOfAction1 }, { type: anyOfAction2 }),
                { type: makeAction(), optional: true },
                { type: makeAction(), passive: true },
            ]
        }));

        expect(EpicManager.getEpicState(activeEpic).counter).toBe(0);
        EpicManager.dispatch(anyOfAction1);
        expect(EpicManager.getEpicState(activeEpic).counter).toBe(1);
        EpicManager.dispatch(anyOfAction2);
        expect(EpicManager.getEpicState(activeEpic).counter).toBe(2);
    });

    it("Should split properly when there are multiple anyOf", function () {
        const epic = makeEpic();
        EpicManager.register(makeCounterEpic(epic, [
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
        
        const updaters = EpicManager.getEpicUpdaters(epic, 0);
        expect(updaters.length).toBe(2 * 2 * 2);
    });
});
