import { createStore } from '../../src/EpicStore';
import { makeEpic, makeAction } from '../helpers/makeEpic';
import Epic from '../../src/Epic';
import Updater from '../../src/Updater';
const EpicStore = createStore(true);

describe("State types: ", function () {
    it("Null State to primitive", function () {
        const epic = makeEpic();
        const action = makeAction();
        EpicStore.register(new Epic(epic, null, null, [
            new Updater([action], function ($0, { state }) {
                return {
                    state: 1
                }
            })
        ]));
        EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic)).toBe(1);
    });

    it("Primitive State to primitive", function () {
        const epic = makeEpic();
        const action = makeAction();
        EpicStore.register(new Epic(epic, 'string', null, [
            new Updater([action], function ($0, { state }) {
                return {
                    state: 1
                }
            })
        ]));
        EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic)).toBe(1);
    });

    it("Deep Object State 1", function () {
        const epic = makeEpic();
        const action = makeAction();
        EpicStore.register(new Epic(epic, { a : { b: 1 }, c: 3 }, null, [
            new Updater([action], function ($0, { state }) {
                return {
                    state: { a: { b: 2 } }
                }
            })
        ]));
        EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic).a.b).toBe(2);
    });

    it("Deep Object State 2", function () {
        const epic = makeEpic();
        const action = makeAction();
        EpicStore.register(new Epic(epic, { a: { b: 1 }, c: 3 }, null, [
            new Updater([action], function ($0, { state }) {
                return {
                    state: { c: 2 }
                }
            })
        ]));
        EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic).a.b).toBe(1);
    });

    it("Deep Object State 2", function () {
        const epic = makeEpic();
        const action = makeAction();
        EpicStore.register(new Epic(epic, { a: [1, 2], c: 3 }, null, [
            new Updater([action], function ($0, { state }) {
                return {
                    state: { c: 2 }
                }
            })
        ]));
        EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic).a[0]).toBe(1);
    });

    it("Array State", function () {
        const epic = makeEpic();
        const action = makeAction();
        EpicStore.register(new Epic(epic, [1, 2, 3], null, [
            new Updater([action], function ($0, { state }) {
                return {
                    state: [1, 2, 3, 4]
                }
            })
        ]));
        EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic)[3]).toBe(4);
    });

    it("No State to primitive", function () {
        const epic = makeEpic();
        const action = makeAction();
        EpicStore.register({ name : epic, updaters: [
            new Updater([action], function ($0, { state }) {
                return {
                    state: 1
                }
            })
        ]});
        EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic)).toBe(1);
    });

    it("No State to object", function () {
        const epic = makeEpic();
        const action = makeAction();
        EpicStore.register({
            name: epic, updaters: [
                new Updater([action], function ($0, { state }) {
                    return {
                        state: { a: 1 }
                    }
                })
            ]
        });
        EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic).a).toBe(1);
    });
});
