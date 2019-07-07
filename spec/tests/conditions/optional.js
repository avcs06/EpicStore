import EpicManager from '../../../src/EpicManager';
import { makeGetter, makeCounterEpic } from '../../helpers/makeEpic';

const make = makeGetter('optional');
const makeEpic = make('epic');
const makeAction = make('action');

describe("Optional condition: ", function() {
    it("Should trigger handler if optional condition not met", function() {
        const epic = makeEpic();
        const activeAction = makeAction();
        EpicManager.register(makeCounterEpic(epic, activeAction, {
            extraConditions: [{ type: makeAction(), optional: true }]
        }));

        EpicManager.dispatch(activeAction);
        expect(EpicManager.getEpicState(epic).counter).toBe(1);
    });

    it("Should not trigger handler with active conditions if only optional condition met", function() {
        const epic = makeEpic();
        const optionalAction = makeAction();
        EpicManager.register(makeCounterEpic(epic, makeAction(), {
            extraConditions: [{ type: optionalAction, optional: true }]
        }));

        EpicManager.dispatch(optionalAction);
        expect(EpicManager.getEpicState(epic).counter).toBe(0);
    });

    it("Should trigger handler with no active conditions if only optional condition met", function() {
        const epic = makeEpic();
        const optionalAction = makeAction();
        EpicManager.register(makeCounterEpic(epic, null, {
            extraConditions: [
                { type: optionalAction, optional: true },
                { type: makeAction(), optional: true },
                { type: makeAction(), passive: true },
            ]
        }));

        EpicManager.dispatch(optionalAction);
        expect(EpicManager.getEpicState(epic).counter).toBe(1);
    });

    it("Should trigger handler only once if optional condition met before active condition", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const action = makeAction();
        EpicManager.register(makeCounterEpic(epic1, action));
        EpicManager.register(makeCounterEpic(epic2, action, {
            extraConditions: [{ type: epic1, optional: true }]
        }));

        EpicManager.dispatch(action);
        expect(EpicManager.getEpicState(epic1).counter).toBe(1);
        expect(EpicManager.getEpicState(epic2).counter).toBe(1);
    });

    // TODO: Known issue will execute epic1 twice
    it("Should trigger handler twice if optional condition met after active condition", function() {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const action = makeAction();
        EpicManager.register(makeCounterEpic(epic1, action, {
            extraConditions: [{ type: epic2, optional: true }]
        }));
        EpicManager.register(makeCounterEpic(epic2, action));

        EpicManager.dispatch(action);
        expect(EpicManager.getEpicState(epic1).counter).toBe(2);
        expect(EpicManager.getEpicState(epic2).counter).toBe(1);
    });
});
