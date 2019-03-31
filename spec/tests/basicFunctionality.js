import EpicManager from '../../src/EpicManager';
import { makeCounterEpic } from '../helpers/makeEpic';

describe("Basic functionalities", function() {
    it("Should update epic state on action", function() {
        makeCounterEpic('BASIC_EPIC_1', 'BASIC_ACTION_1');
        expect(EpicManager.getEpicState('BASIC_EPIC_1').counter).toBe(0);
        EpicManager.dispatch('BASIC_ACTION_1');
        expect(EpicManager.getEpicState('BASIC_EPIC_1').counter).toBe(1);
        EpicManager.dispatch('BASIC_ACTION_1');
        expect(EpicManager.getEpicState('BASIC_EPIC_1').counter).toBe(2);
    });

    it("Should dispatch epic action on epic state update", function() {
        makeCounterEpic('BASIC_EPIC_2', 'BASIC_ACTION_2');
        makeCounterEpic('BASIC_EPIC_3', 'BASIC_EPIC_2');
        expect(EpicManager.getEpicState('BASIC_EPIC_2').counter).toBe(0);
        expect(EpicManager.getEpicState('BASIC_EPIC_3').counter).toBe(0);
        EpicManager.dispatch('BASIC_ACTION_2');
        expect(EpicManager.getEpicState('BASIC_EPIC_2').counter).toBe(1);
        expect(EpicManager.getEpicState('BASIC_EPIC_3').counter).toBe(1);
    });

    it("Should revert state, scope and condition to previous state on error", function() {
        const additionalParams = {};
        makeCounterEpic('BASIC_EPIC_4', 'BASIC_ACTION_4');
        makeCounterEpic('BASIC_EPIC_5', 'BASIC_EPIC_4', additionalParams);
        expect(EpicManager.getEpicState('BASIC_EPIC_4').counter).toBe(0);
        expect(EpicManager.getEpicScope('BASIC_EPIC_4').counter).toBe(0);

        EpicManager.dispatch('BASIC_ACTION_4');
        expect(EpicManager.getEpicState('BASIC_EPIC_4').counter).toBe(1);
        expect(EpicManager.getEpicScope('BASIC_EPIC_4').counter).toBe(1);
        expect(EpicManager.getEpicUpdaters('BASIC_EPIC_5', 0).conditions[0].value.counter).toBe(1);

        additionalParams.withError = true;
        expect(() => EpicManager.dispatch('BASIC_ACTION_4')).toThrow();
        expect(EpicManager.getEpicState('BASIC_EPIC_4').counter).toBe(1);
        expect(EpicManager.getEpicScope('BASIC_EPIC_4').counter).toBe(1);
        expect(EpicManager.getEpicUpdaters('BASIC_EPIC_5', 0).conditions[0].value.counter).toBe(1);

        additionalParams.withError = false;
        EpicManager.dispatch('BASIC_ACTION_4');
        expect(EpicManager.getEpicState('BASIC_EPIC_4').counter).toBe(2);
        expect(EpicManager.getEpicScope('BASIC_EPIC_4').counter).toBe(2);
        expect(EpicManager.getEpicUpdaters('BASIC_EPIC_5', 0).conditions[0].value.counter).toBe(2);
    });
});
