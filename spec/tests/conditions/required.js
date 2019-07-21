import { createStore } from '../../../src/EpicStore';
import { required } from '../../../src/Condition';
import { makeEpic, makeAction, makeCounterEpic } from '../../helpers/makeEpic';
const EpicStore = createStore({ debug: true });

describe("Passive condition: ", function () {
    it("Should not trigger handler if a required condtion is not met", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const action = makeAction();
        EpicStore.register(makeCounterEpic(epic1, makeAction()));
        EpicStore.register(makeCounterEpic(epic2, action, {
            extraConditions: [required(epic1)]
        }));

        EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic2).counter).toBe(0);
    });

    it("All required conditions should be met to execute the handler", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const epic3 = makeEpic();
        const action = makeAction();
        EpicStore.register(makeCounterEpic(epic1, action));
        EpicStore.register(makeCounterEpic(epic2, action));
        EpicStore.register(makeCounterEpic(epic3, [required(epic1), required(epic2)]));

        EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic3).counter).toBe(1);
    });
});
