import EpicManager from '../../src/EpicManager';
import { makeGetter, makeCounterEpic } from '../helpers/makeEpic';

const make = makeGetter('epiclisteners');
const makeEpic = make('epic');
const makeAction = make('action');

describe("Epic Listeners: ", function () {
    it("Should trigger epic listener with proper params", function () {
        const epic = makeEpic();
        const action = makeAction();
        const listenerSpy = jasmine.createSpy('listener');
        EpicManager.register(makeCounterEpic(epic, action));
        EpicManager.addListener([epic], listenerSpy);
        EpicManager.dispatch(action);
        expect(listenerSpy).toHaveBeenCalledWith([{ counter: 1 }], { sourceAction: { type: action } });
    });

    it("Should not trigger epic listener multiple times", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const action = makeAction();
        const listenerSpy = jasmine.createSpy('listener');

        EpicManager.register(makeCounterEpic(epic1, action));
        EpicManager.register(makeCounterEpic(epic2, action));
        EpicManager.addListener([epic1, epic2], listenerSpy);
        EpicManager.dispatch(action);

        expect(listenerSpy).toHaveBeenCalledTimes(1);
        expect(listenerSpy).toHaveBeenCalledWith([{ counter: 1 }, { counter: 1 }], { sourceAction: { type: action } });
    });

    it("removeListener should function as expected", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const action = makeAction();
        const listenerSpy = jasmine.createSpy('listener');

        EpicManager.register(makeCounterEpic(epic1, action));
        EpicManager.register(makeCounterEpic(epic2, action));

        const removeListener = EpicManager.addListener([epic1, epic2], listenerSpy);
        removeListener();

        EpicManager.dispatch(action);
        expect(listenerSpy).not.toHaveBeenCalled();
    });

    it("Epic listener with all optional conditions should not be triggered if none of the optional conditions changed", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const epic3 = makeEpic();
        const action1 = makeAction();
        const action2 = makeAction();
        const listenerSpy = jasmine.createSpy('listener');

        EpicManager.register(makeCounterEpic(epic1, action1));
        EpicManager.register(makeCounterEpic(epic2, action1));
        EpicManager.register(makeCounterEpic(epic3, action2));

        EpicManager.addListener([
            { type: epic1, optional: true },
            { type: epic2, optional: true }
        ], listenerSpy);

        EpicManager.dispatch(action2);
        expect(listenerSpy).not.toHaveBeenCalled();

        EpicManager.dispatch(action1);
        expect(listenerSpy).toHaveBeenCalled();
    });

    it("Passive condition change should not trigger listener", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const action1 = makeAction();
        const action2 = makeAction();
        const listenerSpy = jasmine.createSpy('listener');

        EpicManager.register(makeCounterEpic(epic1, action1));
        EpicManager.register(makeCounterEpic(epic2, action2));

        EpicManager.addListener([
            { type: epic1, passive: true },
            { type: epic2, optional: true }
        ], listenerSpy);

        EpicManager.dispatch(action1);
        expect(listenerSpy).not.toHaveBeenCalled();

        EpicManager.dispatch(action2);
        expect(listenerSpy).toHaveBeenCalled();
    });
});
