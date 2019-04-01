import EpicManager from '../../../src/EpicManager';
import { makeCounterEpic } from '../../helpers/makeEpic';

describe("Passive condition: ", function() {
    it("Should not trigger handler on passive condition change", function() {
        makeCounterEpic('PASSIVE_EPIC_1', 'PASSIVE_ACTION_1');
        makeCounterEpic('PASSIVE_EPIC_2', 'PASSIVE_ACTION_2', {
            extraConditions: [{ type: 'PASSIVE_EPIC_1', passive: true }]
        });

        EpicManager.dispatch('PASSIVE_ACTION_1');
        expect(EpicManager.getEpicState('PASSIVE_EPIC_1').counter).toBe(1);
        expect(EpicManager.getEpicState('PASSIVE_EPIC_2').counter).toBe(0);
    });

    // TODO: Known issue will execute PASSIVE_EPIC_6 twice but PASSIVE_EPIC_5 once
    it("Should trigger handler if passive condition is updated after active condition", function() {
        makeCounterEpic('PASSIVE_EPIC_3', 'PASSIVE_ACTION_3');
        makeCounterEpic('PASSIVE_EPIC_4', 'PASSIVE_ACTION_3');

        makeCounterEpic('PASSIVE_EPIC_5', 'PASSIVE_EPIC_4', {
            extraConditions: [{ type: 'PASSIVE_EPIC_3', passive: true }]
        });
        makeCounterEpic('PASSIVE_EPIC_6', 'PASSIVE_EPIC_3', {
            extraConditions: [{ type: 'PASSIVE_EPIC_4', passive: true }]
        });

        EpicManager.dispatch('PASSIVE_ACTION_3');
        expect(EpicManager.getEpicState('PASSIVE_EPIC_3').counter).toBe(1);
        expect(EpicManager.getEpicState('PASSIVE_EPIC_4').counter).toBe(1);
    
        // Here PASSIVE_EPIC_5 will be executed once
        expect(EpicManager.getEpicState('PASSIVE_EPIC_5').counter).toBe(1);
        // Here PASSIVE_EPIC_6 will be executed twice
        expect(EpicManager.getEpicState('PASSIVE_EPIC_6').counter).toBe(2);
    });
});
