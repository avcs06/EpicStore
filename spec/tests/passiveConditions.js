import EpicManager from '../../src/EpicManager';
import Updater from '../../src/Updater';
import { makeCounterEpic } from '../helpers/makeEpic';

describe("Passive condition", function() {
    it("Should not trigger handler on passive condition change", function() {
        makeCounterEpic('PASSIVE_EPIC_1', 'PASSIVE_ACTION_1');
        makeCounterEpic('PASSIVE_EPIC_2', 'PASSIVE_ACTION_2', {
            extraConditions: [{ type: 'PASSIVE_EPIC_1', passive: true }]
        });

        EpicManager.dispatch('PASSIVE_ACTION_1');
        expect(EpicManager.getEpicState('PASSIVE_EPIC_2').counter).toBe(0);
    });
});
