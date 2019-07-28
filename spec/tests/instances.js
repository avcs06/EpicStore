import { createStore } from '../../src/EpicStore';
import { makeEpic, makeAction, makeCounterEpic } from '../helpers/makeEpic';
import Epic from '../../src/Epic';
import Updater from '../../src/Updater';
const EpicStore = createStore({ debug: true, patterns: true });

const normalAction = makeAction();
const patternAction = 'PATTERN_*';
const makeInstance = (() => {
    let counter = 0;
    return () => new Epic('INSTANCE_' + counter++, { counter: 0 }, null, [
        new Updater([normalAction, patternAction], ($0, { state }) => {
            return { state: { counter: state.counter + 1 } };
        })
    ]);
})();

describe("Instances: ", function () {
    it("When an action target is mentioned only the targeted epic should be updated", function () {
        const epic = makeEpic();
        const instance1 = makeInstance();
        const instance2 = makeInstance();

        EpicStore.register(instance1);
        EpicStore.register(instance2);
        EpicStore.register(makeCounterEpic(epic, 'INSTANCE_*'));

        expect(EpicStore.getEpicState(instance1.name).counter).toBe(0);
        expect(EpicStore.getEpicState(instance2.name).counter).toBe(0);
        expect(EpicStore.getEpicState(epic).counter).toBe(0);

        EpicStore.dispatch({ type: normalAction, target: instance1.name });
        expect(EpicStore.getEpicState(instance1.name).counter).toBe(1);
        expect(EpicStore.getEpicState(instance2.name).counter).toBe(0);
        expect(EpicStore.getEpicState(epic).counter).toBe(1);

        EpicStore.dispatch({ type: patternAction, target: instance2.name });
        expect(EpicStore.getEpicState(instance1.name).counter).toBe(1);
        expect(EpicStore.getEpicState(instance2.name).counter).toBe(1);
        expect(EpicStore.getEpicState(epic).counter).toBe(2);
    });
});
