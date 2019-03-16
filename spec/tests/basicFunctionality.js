import EpicManager from '../../src/EpicManager';
import { makeCounterEpic } from '../helpers/makeEpic';

describe("Basic functionalities", function() {
    it("Should update state on action", function() {
        makeCounterEpic('BASIC_EPIC_1', 'BASIC_ACTION_1');
        expect(EpicManager.getEpicState('BASIC_EPIC_1').counter).toBe(0);
        EpicManager.dispatch('BASIC_ACTION_1');
        expect(EpicManager.getEpicState('BASIC_EPIC_1').counter).toBe(1);
        EpicManager.dispatch('BASIC_ACTION_1');
        expect(EpicManager.getEpicState('BASIC_EPIC_1').counter).toBe(2);
    });

    it("Should dispatch epic action on update", function() {
        makeCounterEpic('BASIC_EPIC_2', 'BASIC_ACTION_2');
        makeCounterEpic('BASIC_EPIC_3', null, { extraConditions: [{ type: 'BASIC_EPIC_2' }] });
        expect(EpicManager.getEpicState('BASIC_EPIC_2').counter).toBe(0);
        expect(EpicManager.getEpicState('BASIC_EPIC_3').counter).toBe(0);
        EpicManager.dispatch('BASIC_ACTION_2');
        expect(EpicManager.getEpicState('BASIC_EPIC_2').counter).toBe(1);
        expect(EpicManager.getEpicState('BASIC_EPIC_3').counter).toBe(1);
    });
});
