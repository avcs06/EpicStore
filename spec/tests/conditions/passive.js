import { createStore } from '../../../src/EpicStore';
import { makeGetter, makeCounterEpic } from '../../helpers/makeEpic';

const make = makeGetter('passive');
const makeEpic = make('epic');
const makeAction = make('action');
const EpicStore = createStore(true);

describe("Passive condition: ", function() {
    it("Should not trigger handler on passive condition change", function() {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const action = makeAction();
        EpicStore.register(makeCounterEpic(epic1, action));
        EpicStore.register(makeCounterEpic(epic2, makeAction(), {
            extraConditions: [{ type: epic1, passive: true }]
        }));

        EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic1).counter).toBe(1);
        expect(EpicStore.getEpicState(epic2).counter).toBe(0);
    });

    // TODO: Known issue will execute PASSIVE_EPIC_6 twice but PASSIVE_EPIC_5 once
    it("Should trigger handler if passive condition is updated after active condition", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const epic3 = makeEpic();
        const epic4 = makeEpic();
        const action = makeAction();

        EpicStore.register(makeCounterEpic(epic1, action));
        EpicStore.register(makeCounterEpic(epic2, action));

        EpicStore.register(makeCounterEpic(epic3, epic2, {
            extraConditions: [{ type: epic1, passive: true }]
        }));
        EpicStore.register(makeCounterEpic(epic4, epic1, {
            extraConditions: [{ type: epic2, passive: true }]
        }));

        EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic1).counter).toBe(1);
        expect(EpicStore.getEpicState(epic2).counter).toBe(1);
    
        // Here PASSIVE_EPIC_5 will be executed once
        expect(EpicStore.getEpicState(epic3).counter).toBe(1);
        // Here PASSIVE_EPIC_6 will be executed twice
        expect(EpicStore.getEpicState(epic4).counter).toBe(2);
    });
});
