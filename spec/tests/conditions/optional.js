import EpicManager from '../../../src/EpicManager';
import { makeGetter, makeCounterEpic } from '../../helpers/makeEpic';

const makeOptional = makeGetter('optional');
const makeOptionalEpic = makeOptional('epic');
const makeOptionalAction = makeOptional('action');

describe("Optional condition: ", function() {
    it("Should trigger handler if optional condition not met", function() {
        const activeEpic = makeOptionalEpic();
        const activeAction = makeOptionalAction();
        makeCounterEpic(activeEpic, activeAction, {
            extraConditions: [{ type: makeOptionalAction(), optional: true }]
        });

        EpicManager.dispatch(activeAction);
        expect(EpicManager.getEpicState(activeEpic).counter).toBe(1);
    });

    it("Should not trigger handler with active conditions if only optional condition met", function() {
        makeCounterEpic('OPTIONAL_EPIC_2', 'OPTIONAL_ACTION_3', {
            extraConditions: [{ type: 'OPTIONAL_ACTION_4', optional: true }]
        });

        EpicManager.dispatch('OPTIONAL_ACTION_4');
        expect(EpicManager.getEpicState('OPTIONAL_EPIC_2').counter).toBe(0);
    });

    it("Should trigger handler with no active conditions if only optional condition met", function() {
        const activeEpic = makeOptionalEpic();
        const optionalAction1 = makeOptionalAction();
        makeCounterEpic(activeEpic, null, {
            extraConditions: [
                { type: optionalAction1, optional: true },
                { type: makeOptionalAction(), optional: true },
                { type: makeOptionalAction(), passive: true },
            ]
        });

        EpicManager.dispatch(optionalAction1);
        expect(EpicManager.getEpicState(activeEpic).counter).toBe(1);
    });

    it("Should trigger handler once if optional condition met before active condition", function() {
        makeCounterEpic('OPTIONAL_EPIC_5', 'OPTIONAL_ACTION_6');
        makeCounterEpic('OPTIONAL_EPIC_6', 'OPTIONAL_ACTION_6', {
            extraConditions: [{ type: 'OPTIONAL_EPIC_5', optional: true }]
        });

        EpicManager.dispatch('OPTIONAL_ACTION_6');
        expect(EpicManager.getEpicState('OPTIONAL_EPIC_5').counter).toBe(1);
        expect(EpicManager.getEpicState('OPTIONAL_EPIC_6').counter).toBe(1);
    });

    // TODO: Known issue will execute OPTIONAL_EPIC_3 twice
    it("Should trigger handler twice if optional condition met after active condition", function() {
        makeCounterEpic('OPTIONAL_EPIC_3', 'OPTIONAL_ACTION_5', {
            extraConditions: [{ type: 'OPTIONAL_EPIC_4', optional: true }]
        });
        makeCounterEpic('OPTIONAL_EPIC_4', 'OPTIONAL_ACTION_5');

        EpicManager.dispatch('OPTIONAL_ACTION_5');
        expect(EpicManager.getEpicState('OPTIONAL_EPIC_3').counter).toBe(2);
        expect(EpicManager.getEpicState('OPTIONAL_EPIC_4').counter).toBe(1);
    });
});
