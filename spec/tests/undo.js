import { createStore } from '../../src/EpicStore';
import { makeEpic, makeAction, makeCounterEpic } from '../helpers/makeEpic';
import { INITIAL_VALUE } from '../../src/object-utils';
const EpicStore = createStore({ undo: true, maxUndoStack: 3 });

describe("Undo: ", function () {
    it("Should Undo all the states on undo + Max undo + redo", function () {
        const epic1 = makeEpic();
        const epic2 = makeEpic();
        const epic3 = makeEpic();
        const epic4 = makeEpic();
        const action = makeAction();
        EpicStore.register(makeCounterEpic(epic1, action));
        EpicStore.register(makeCounterEpic(epic2, action));
        EpicStore.register(makeCounterEpic(epic3, epic1));
        EpicStore.register(makeCounterEpic(epic4, epic2));

        expect(EpicStore.getEpicState(epic1).counter).toBe(0);
        expect(EpicStore.getEpicState(epic2).counter).toBe(0);
        expect(EpicStore.getEpicState(epic3).counter).toBe(0);
        expect(EpicStore.getEpicState(epic4).counter).toBe(0);

        EpicStore.dispatch(action);
        EpicStore.dispatch(action);
        EpicStore.dispatch(action);
        EpicStore.dispatch(action);
        expect(EpicStore.getEpicState(epic1).counter).toBe(4);
        expect(EpicStore.getEpicState(epic2).counter).toBe(4);
        expect(EpicStore.getEpicState(epic3).counter).toBe(4);
        expect(EpicStore.getEpicState(epic4).counter).toBe(4);

        EpicStore.undo();
        expect(EpicStore.getEpicState(epic1).counter).toBe(3);
        expect(EpicStore.getEpicState(epic2).counter).toBe(3);
        expect(EpicStore.getEpicState(epic3).counter).toBe(3);
        expect(EpicStore.getEpicState(epic4).counter).toBe(3);
        EpicStore.undo();
        EpicStore.undo();
        EpicStore.undo();
        expect(EpicStore.getEpicState(epic1).counter).toBe(1);
        expect(EpicStore.getEpicState(epic2).counter).toBe(1);
        expect(EpicStore.getEpicState(epic3).counter).toBe(1);
        expect(EpicStore.getEpicState(epic4).counter).toBe(1);

        EpicStore.redo();
        EpicStore.redo();
        EpicStore.redo();
        expect(EpicStore.getEpicState(epic1).counter).toBe(4);
        expect(EpicStore.getEpicState(epic2).counter).toBe(4);
        expect(EpicStore.getEpicState(epic3).counter).toBe(4);
        expect(EpicStore.getEpicState(epic4).counter).toBe(4);
    });

    it("Various Object State Undo", function () {
        const epic = makeEpic();
        const action1 = makeAction();
        const action2 = makeAction();
        const action3 = makeAction();
        EpicStore.register({
            name: epic, state: { a: { b : 1 } }, updaters: [
                {
                    conditions: [action1, action2, action3],
                    handler: (conditions, { sourceAction: { type } }) => {
                        if (type === action1) {
                            return {
                                state: { c: 1 }
                            };
                        } else if (type === action2) {
                            return {
                                state: { a: { b: 2 } }
                            };
                        } else {
                            return {
                                state: { a: 2 }
                            };
                        }
                    }
                }
            ]
        });
        EpicStore.register(makeCounterEpic(makeEpic(), epic));

        EpicStore.dispatch(action2);
        expect(EpicStore.getEpicState(epic)).toEqual({ a: { b: 2 } });

        EpicStore.dispatch(action1);
        expect(EpicStore.getEpicState(epic)).toEqual({ a: { b: 2 }, c: 1 });

        EpicStore.dispatch(action3);
        expect(EpicStore.getEpicState(epic)).toEqual({ a: 2, c: 1 });

        EpicStore.undo();
        expect(EpicStore.getEpicState(epic)).toEqual({ a: { b: 2 }, c: 1 });

        EpicStore.undo();
        expect(EpicStore.getEpicState(epic)).toEqual({ a: { b: 2 } });

        EpicStore.undo();
        expect(EpicStore.getEpicState(epic)).toEqual({ a: { b: 1 } });

        EpicStore.redo();
        expect(EpicStore.getEpicState(epic)).toEqual({ a: { b: 2 } });

        EpicStore.redo();
        expect(EpicStore.getEpicState(epic)).toEqual({ a: { b: 2 }, c: 1 });

        EpicStore.redo();
        expect(EpicStore.getEpicState(epic)).toEqual({ a: 2, c: 1 });
    });

    it("Primitive Undo", function () {
        const epic = makeEpic();
        const action1 = makeAction();
        const action2 = makeAction();
        const action3 = makeAction();
        EpicStore.register({
            name: epic, state: null, updaters: [
                {
                    conditions: [action1, action2, action3],
                    handler: (conditions, { sourceAction: { type } }) => {
                        if (type === action1) {
                            return { state: [1, 2, 3] };
                        } else if (type === action2) {
                            return { state: 'a' };
                        } else {
                            return { state: Function.prototype };
                        }
                    }
                }
            ]
        });

        EpicStore.dispatch(action1);
        expect(EpicStore.getEpicState(epic)).toEqual([1, 2, 3]);

        EpicStore.dispatch(action2);
        expect(EpicStore.getEpicState(epic)).toEqual('a');

        EpicStore.dispatch(action3);
        expect(EpicStore.getEpicState(epic)).toEqual(Function.prototype);

        EpicStore.undo();
        expect(EpicStore.getEpicState(epic)).toEqual('a');

        EpicStore.undo();
        expect(EpicStore.getEpicState(epic)).toEqual([1, 2, 3]);

        EpicStore.undo();
        expect(EpicStore.getEpicState(epic)).toEqual(INITIAL_VALUE);

        EpicStore.redo();
        expect(EpicStore.getEpicState(epic)).toEqual([1, 2, 3]);

        EpicStore.redo();
        expect(EpicStore.getEpicState(epic)).toEqual('a');

        EpicStore.redo();
        expect(EpicStore.getEpicState(epic)).toEqual(Function.prototype);
    });
});
