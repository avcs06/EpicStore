import { Store, readonly, withSelector, resolve } from '../../src';
import { makeEpic, makeAction, makeCounterEpic } from '../helpers/makeEpic';
const EpicStore = new Store();

describe("Epic Listeners: ", function () {
    it("Should trigger epic listener with proper params", function () {
        const epic = makeEpic();
        const action = makeAction();
        const listenerSpy = jasmine.createSpy('listener');
        EpicStore.register(makeCounterEpic(epic, action));
        EpicStore.on(epic, listenerSpy);
        EpicStore.dispatch(action);
        expect(listenerSpy).toHaveBeenCalledWith({ counter: 1 }, { type: action });
    });

    it("Should not trigger epic listener multiple times", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const action = makeAction();
        const listenerSpy = jasmine.createSpy('listener');

        EpicStore.register(makeCounterEpic(epic1, action));
        EpicStore.register(makeCounterEpic(epic2, action));
        EpicStore.on(resolve([epic1, epic2]), listenerSpy);
        EpicStore.dispatch(action);

        expect(listenerSpy).toHaveBeenCalledTimes(1);
        expect(listenerSpy).toHaveBeenCalledWith([{ counter: 1 }, { counter: 1 }], { type: action });
    });

    it("removeListener should function as expected", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const action = makeAction();
        const listenerSpy = jasmine.createSpy('listener');

        EpicStore.register(makeCounterEpic(epic1, action));
        EpicStore.register(makeCounterEpic(epic2, action));

        const removeListener = EpicStore.on(resolve([epic1, epic2]), listenerSpy);
        removeListener();

        EpicStore.dispatch(action);
        expect(listenerSpy).not.toHaveBeenCalled();
    });

    it("Epic listener should not be triggered if none of the conditions changed", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const epic3 = makeEpic();
        const action1 = makeAction();
        const action2 = makeAction();
        const listenerSpy = jasmine.createSpy('listener');

        EpicStore.register(makeCounterEpic(epic1, action1));
        EpicStore.register(makeCounterEpic(epic2, action1));
        EpicStore.register(makeCounterEpic(epic3, action2));
        EpicStore.on(resolve([epic1, epic2]), listenerSpy);

        EpicStore.dispatch(action2);
        expect(listenerSpy).not.toHaveBeenCalled();

        EpicStore.dispatch(action1);
        expect(listenerSpy).toHaveBeenCalled();
    });

    it("Passive condition change should not trigger listener", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const action1 = makeAction();
        const action2 = makeAction();
        const listenerSpy = jasmine.createSpy('listener');

        EpicStore.register(makeCounterEpic(epic1, action1));
        EpicStore.register(makeCounterEpic(epic2, action2));
        EpicStore.on(resolve([readonly(epic1), epic2 ]), listenerSpy);

        EpicStore.dispatch(action1);
        expect(listenerSpy).not.toHaveBeenCalled();

        EpicStore.dispatch(action2);
        expect(listenerSpy).toHaveBeenCalled();
    });

    it("Epic listener should be triggered if any one condition met", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const action1 = makeAction();
        const action2 = makeAction();
        const listenerSpy = jasmine.createSpy('listener');

        EpicStore.register(makeCounterEpic(epic1, action1));
        EpicStore.register(makeCounterEpic(epic2, action2));
        EpicStore.on(resolve([epic1, epic2]), listenerSpy);

        EpicStore.dispatch(action1);
        expect(listenerSpy).toHaveBeenCalled();

        EpicStore.dispatch(action2);
        expect(listenerSpy).toHaveBeenCalled();
    });

    it("If some of the listeners throw error, the successful listeners should still be executed", function () {
        const epic = makeEpic();
        const action = makeAction();
        const listenerSpy1 = jasmine.createSpy('listener1');
        const listenerSpy2 = jasmine.createSpy('listener2');

        EpicStore.register(makeCounterEpic(epic, action));
        EpicStore.on(epic, function () { throw "Fake Error"; });
        EpicStore.on(epic, listenerSpy1);
        EpicStore.on(epic, function () { throw "Fake Error"; });
        EpicStore.on(epic, listenerSpy2);

        expect(() => EpicStore.dispatch(action)).toThrow(['Fake Error', 'Fake Error']);
        expect(listenerSpy1).toHaveBeenCalled();
        expect(listenerSpy2).toHaveBeenCalled();
    });

    it("Removing multiple epic listeners should not throw error", function () {
        const epic = makeEpic();
        const action = makeAction();
        const listenerSpy1 = jasmine.createSpy('listener1');
        const listenerSpy2 = jasmine.createSpy('listener2');

        EpicStore.register(makeCounterEpic(epic, action));
        const removeListener1 = EpicStore.on([epic], listenerSpy1);
        const removeListener2 = EpicStore.on([epic], listenerSpy2);
        removeListener1();
        expect(() => removeListener2()).not.toThrow();
    });
});
