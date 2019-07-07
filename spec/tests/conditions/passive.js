import EpicManager from '../../../src/EpicManager';
import { makeGetter, makeCounterEpic } from '../../helpers/makeEpic';

const make = makeGetter('passive');
const makeEpic = make('epic');
const makeAction = make('action');

describe("Passive condition: ", function() {
    it("Should not trigger handler on passive condition change", function() {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const action = makeAction();
        EpicManager.register(makeCounterEpic(epic1, action));
        EpicManager.register(makeCounterEpic(epic2, makeAction(), {
            extraConditions: [{ type: epic1, passive: true }]
        }));

        EpicManager.dispatch(action);
        expect(EpicManager.getEpicState(epic1).counter).toBe(1);
        expect(EpicManager.getEpicState(epic2).counter).toBe(0);
    });

    // TODO: Known issue will execute PASSIVE_EPIC_6 twice but PASSIVE_EPIC_5 once
    it("Should trigger handler if passive condition is updated after active condition", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const epic3 = makeEpic();
        const epic4 = makeEpic();
        const action = makeAction();

        EpicManager.register(makeCounterEpic(epic1, action));
        EpicManager.register(makeCounterEpic(epic2, action));

        EpicManager.register(makeCounterEpic(epic3, epic2, {
            extraConditions: [{ type: epic1, passive: true }]
        }));
        EpicManager.register(makeCounterEpic(epic4, epic1, {
            extraConditions: [{ type: epic2, passive: true }]
        }));

        EpicManager.dispatch(action);
        expect(EpicManager.getEpicState(epic1).counter).toBe(1);
        expect(EpicManager.getEpicState(epic2).counter).toBe(1);
    
        // Here PASSIVE_EPIC_5 will be executed once
        expect(EpicManager.getEpicState(epic3).counter).toBe(1);
        // Here PASSIVE_EPIC_6 will be executed twice
        expect(EpicManager.getEpicState(epic4).counter).toBe(2);
    });
});
