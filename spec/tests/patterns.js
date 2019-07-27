import { createStore } from '../../src/EpicStore';
import { makeEpic, makeAction, makeCounterEpic } from '../helpers/makeEpic';
import Action from '../../src/Action';
import { passive, required } from '../../src/Condition';
const EpicStore = createStore({ debug: true, patterns: true });

describe("Pattern Conditions: ", function () {
    it("Updater handler should be executed if it has any action as a condition on any action", function () {
        const epic = makeEpic();
        EpicStore.register(makeCounterEpic(epic, '*'));
        expect(EpicStore.getEpicState(epic).counter).toBe(0);
        EpicStore.dispatch(makeAction());
        expect(EpicStore.getEpicState(epic).counter).toBe(1);
    });

    it("Updater handler should receive undefined as condition value if the condition is a pattern", function () {
        const epic = makeEpic();
        const verify = jasmine.createSpy('verify');
        EpicStore.register(makeCounterEpic(epic, '*', { verify }));
        EpicStore.dispatch(new Action(makeAction(), 1));
        expect(verify).toHaveBeenCalledWith([undefined], jasmine.any(Object));
    });

    it("If there are multiple updaters listening to all action conditions, the cycle shouldnt go into infinite loop", function () {
        EpicStore.register(makeCounterEpic(makeEpic(), '*'));
        EpicStore.register(makeCounterEpic(makeEpic(), '*'));
        expect(() => EpicStore.dispatch(makeAction())).not.toThrow();
    });

    it("Epics should be executed on non all action patterns and the epics should dispatch an epic action", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const epic3 = makeEpic();
        EpicStore.register(makeCounterEpic(epic1, 'PATTERN_1*'));
        EpicStore.register(makeCounterEpic(epic2, 'PATTERN_2*'));
        EpicStore.register(makeCounterEpic(epic3, [epic1, epic2]));

        expect(EpicStore.getEpicState(epic1).counter).toBe(0);
        expect(EpicStore.getEpicState(epic2).counter).toBe(0);
        expect(EpicStore.getEpicState(epic3).counter).toBe(0);

        EpicStore.dispatch('PATTERN_11');
        expect(EpicStore.getEpicState(epic1).counter).toBe(1);
        expect(EpicStore.getEpicState(epic2).counter).toBe(0);
        expect(EpicStore.getEpicState(epic3).counter).toBe(1);

        EpicStore.dispatch('PATTERN_22');
        expect(EpicStore.getEpicState(epic1).counter).toBe(1);
        expect(EpicStore.getEpicState(epic2).counter).toBe(1);
        expect(EpicStore.getEpicState(epic3).counter).toBe(2);
    });

    it("Different pattern types", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const epic3 = makeEpic();
        const epic4 = makeEpic();

        EpicStore.register(makeCounterEpic(epic1, 'PATTERN_*'));
        EpicStore.register(makeCounterEpic(epic2, '*_A'));
        EpicStore.register(makeCounterEpic(epic3, 'PATTERN*1'));
        EpicStore.register(makeCounterEpic(epic4, '*A*'));

        expect(EpicStore.getEpicState(epic1).counter).toBe(0);
        expect(EpicStore.getEpicState(epic2).counter).toBe(0);
        expect(EpicStore.getEpicState(epic3).counter).toBe(0);
        expect(EpicStore.getEpicState(epic4).counter).toBe(0);

        EpicStore.dispatch('PATTERN_22');
        expect(EpicStore.getEpicState(epic1).counter).toBe(1);
        expect(EpicStore.getEpicState(epic2).counter).toBe(0);
        expect(EpicStore.getEpicState(epic3).counter).toBe(0);
        expect(EpicStore.getEpicState(epic4).counter).toBe(1);

        EpicStore.dispatch('PATTERN_A');
        expect(EpicStore.getEpicState(epic1).counter).toBe(2);
        expect(EpicStore.getEpicState(epic2).counter).toBe(1);
        expect(EpicStore.getEpicState(epic3).counter).toBe(0);
        expect(EpicStore.getEpicState(epic4).counter).toBe(2);

        EpicStore.dispatch('PATTERN_11');
        expect(EpicStore.getEpicState(epic1).counter).toBe(3);
        expect(EpicStore.getEpicState(epic2).counter).toBe(1);
        expect(EpicStore.getEpicState(epic3).counter).toBe(1);
        expect(EpicStore.getEpicState(epic4).counter).toBe(3);

        EpicStore.dispatch('BPATTERN_11');
        expect(EpicStore.getEpicState(epic1).counter).toBe(3);
        expect(EpicStore.getEpicState(epic2).counter).toBe(1);
        expect(EpicStore.getEpicState(epic3).counter).toBe(1);
        expect(EpicStore.getEpicState(epic4).counter).toBe(4);

        EpicStore.dispatch('PBTTERN_1');
        expect(EpicStore.getEpicState(epic1).counter).toBe(3);
        expect(EpicStore.getEpicState(epic2).counter).toBe(1);
        expect(EpicStore.getEpicState(epic3).counter).toBe(1);
        expect(EpicStore.getEpicState(epic4).counter).toBe(4);

        EpicStore.dispatch('PATTERN_');
        expect(EpicStore.getEpicState(epic1).counter).toBe(4);
        expect(EpicStore.getEpicState(epic2).counter).toBe(1);
        expect(EpicStore.getEpicState(epic3).counter).toBe(1);
        expect(EpicStore.getEpicState(epic4).counter).toBe(5);
    });

    it("Pattern conditions should function simillar to other conditions", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const epic3 = makeEpic();
        const action = makeAction();

        EpicStore.register(makeCounterEpic(epic1, [passive('PATTERN_*'), action]));
        EpicStore.register(makeCounterEpic(epic2, [required('PATTERN_*'), action]));
        EpicStore.register(makeCounterEpic(epic3, ['PATTERN_*', action]));

        expect(EpicStore.getEpicState(epic1).counter).toBe(0);
        expect(EpicStore.getEpicState(epic2).counter).toBe(0);
        expect(EpicStore.getEpicState(epic3).counter).toBe(0);

        EpicStore.dispatch('PATTERN_1');
        expect(EpicStore.getEpicState(epic1).counter).toBe(0);
        expect(EpicStore.getEpicState(epic2).counter).toBe(1);
        expect(EpicStore.getEpicState(epic3).counter).toBe(1);

        EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic1).counter).toBe(1);
        expect(EpicStore.getEpicState(epic2).counter).toBe(1);
        expect(EpicStore.getEpicState(epic3).counter).toBe(2);
    });
});


describe("Pattern Listeners: ", function () {
    it("Epic listener with a pattern condition should work as expected", function () {
        const epic = makeEpic();
        const action1 = makeAction();
        const action2 = makeAction();
        const action3 = makeAction();
        const listenerSpy1 = jasmine.createSpy('listener1');
        const listenerSpy2 = jasmine.createSpy('listener2');
        const listenerSpy3 = jasmine.createSpy('listener3');

        EpicStore.register(makeCounterEpic('PATTERN_1', [passive(action1), action2]));
        EpicStore.register(makeCounterEpic('PATTERN_2', [required(action1), action2]));
        EpicStore.register(makeCounterEpic('PATTERN_3', [action1, action2]));
        EpicStore.register(makeCounterEpic(epic, [action3, action2]));

        EpicStore.addListener(['PATTERN_*', epic], listenerSpy1);
        EpicStore.addListener([required('PATTERN_*'), epic], listenerSpy2);
        EpicStore.addListener([passive('PATTERN_*'), epic], listenerSpy3);

        EpicStore.dispatch(action1);
        expect(listenerSpy1).toHaveBeenCalledTimes(1);
        expect(listenerSpy2).toHaveBeenCalledTimes(1);
        expect(listenerSpy3).toHaveBeenCalledTimes(0);
        expect(listenerSpy1).toHaveBeenCalledWith([undefined, undefined], jasmine.any(Object));

        EpicStore.dispatch(action2);
        expect(listenerSpy1).toHaveBeenCalledTimes(2);
        expect(listenerSpy2).toHaveBeenCalledTimes(2);
        expect(listenerSpy3).toHaveBeenCalledTimes(1);

        EpicStore.dispatch(action3);
        expect(listenerSpy1).toHaveBeenCalledTimes(3);
        expect(listenerSpy2).toHaveBeenCalledTimes(2);
        expect(listenerSpy3).toHaveBeenCalledTimes(2);
    });
});
