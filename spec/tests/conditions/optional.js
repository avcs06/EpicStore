import { createStore } from '../../../src/EpicStore';
import { makeGetter, makeCounterEpic } from '../../helpers/makeEpic';

const make = makeGetter('optional');
const makeEpic = make('epic');
const makeAction = make('action');
const EpicStore = createStore(true);

describe("Optional condition: ", function() {
    it("Should trigger handler if optional condition not met", function() {
        const epic = makeEpic();
        const activeAction = makeAction();
        EpicStore.register(makeCounterEpic(epic, activeAction, {
            extraConditions: [{ type: makeAction(), optional: true }]
        }));

        EpicStore.dispatch(activeAction);
        expect(EpicStore.getEpicState(epic).counter).toBe(1);
    });

    it("Should not trigger handler with active conditions if only optional condition met", function() {
        const epic = makeEpic();
        const optionalAction = makeAction();
        EpicStore.register(makeCounterEpic(epic, makeAction(), {
            extraConditions: [{ type: optionalAction, optional: true }]
        }));

        EpicStore.dispatch(optionalAction);
        expect(EpicStore.getEpicState(epic).counter).toBe(0);
    });

    it("Should trigger handler with no active conditions if only optional condition met", function() {
        const epic = makeEpic();
        const optionalAction = makeAction();
        EpicStore.register(makeCounterEpic(epic, null, {
            extraConditions: [
                { type: optionalAction, optional: true },
                { type: makeAction(), optional: true },
                { type: makeAction(), passive: true },
            ]
        }));

        EpicStore.dispatch(optionalAction);
        expect(EpicStore.getEpicState(epic).counter).toBe(1);
    });

    it("Should trigger handler only once if optional condition met before active condition", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const action = makeAction();
        EpicStore.register(makeCounterEpic(epic1, action));
        EpicStore.register(makeCounterEpic(epic2, action, {
            extraConditions: [{ type: epic1, optional: true }]
        }));

        EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic1).counter).toBe(1);
        expect(EpicStore.getEpicState(epic2).counter).toBe(1);
    });
});
