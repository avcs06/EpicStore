import { Store, Epic } from '../../src';
import { makeEpic, makeAction } from '../helpers/makeEpic';
const EpicStore = new Store();

describe("State types: ", function () {
    it("Primitive State to primitive", function () {
        const epic1 = makeEpic();
        const action = makeAction();
        const epic = new Epic(epic1, 'string');
        EpicStore.register(epic);

        epic.on(action, () => ({ state: 1 }));
        EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic1)).toBe(1);
    });

    it("Deep Object State 1", function () {
        const epic1 = makeEpic();
        const action = makeAction();
        const epic = new Epic(epic1, { a: { b: 1 }, c: 3 });
        EpicStore.register(epic);

        epic.on(action, () => ({ state: { a: { b: 2 } } }));
        EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic1).a.b).toBe(2);
    });

    it("Deep Object State 2", function () {
        const epic1 = makeEpic();
        const action = makeAction();
        const epic = new Epic(epic1, { a: { b: 1 }, c: 3 });
        EpicStore.register(epic);

        epic.on(action, () => ({ state: { c: 2 } }));
        EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic1).a.b).toBe(1);
    });

    it("Deep Object State 3", function () {
        const epic1 = makeEpic();
        const action = makeAction();
        const epic = new Epic(epic1, { a: [1, 2], c: 3 });
        EpicStore.register(epic);

        epic.on(action, () => ({ state: { c: 2 } }));
        EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic1).a[0]).toBe(1);
    });

    it("Array State", function () {
        const epic1 = makeEpic();
        const action = makeAction();
        const epic = new Epic(epic1, [1, 2, 3]);
        EpicStore.register(epic);

        epic.on(action, () => ({ state: [1, 2, 3, 4] }));
        EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic1)[3]).toBe(4);
    });

    it("No State to primitive", function () {
        const epic1 = makeEpic();
        const action = makeAction();
        const epic = new Epic(epic1);
        EpicStore.register(epic);

        epic.on(action, () => ({ state: 1 }));
        EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic1)).toBe(1);
    });

    it("No State to object", function () {
        const epic1 = makeEpic();
        const action = makeAction();
        const epic = new Epic(epic1);
        EpicStore.register(epic);

        epic.on(action, () => ({ state: { a: 1 } }));
        EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic1).a).toBe(1);
    });
});
