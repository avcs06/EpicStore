import { createStore } from '../../src/EpicStore';
import { error } from '../../src/Errors';
import Updater from '../../src/Updater';
import Epic from '../../src/Epic';
import { makeEpic, makeAction, makeCounterEpic } from '../helpers/makeEpic';
const EpicStore = createStore({ debug: true });

const invariantError = message => {
  const error = new Error(message);
  error.name = 'Invariant Violation';
  return error;
};

describe("Invalid Entries: should throw error", function() {
  it("on duplicate epic name", function() {
    EpicStore.register({ name: 'INVALID_EPIC_1' });
    expect(() => {
      EpicStore.register({ name: 'INVALID_EPIC_1' });
    }).toThrow(invariantError(error('duplicateEpic', 'INVALID_EPIC_1')));
  });

  it("if no active listeners are passed", function() {
    expect(() => {
      EpicStore.register({
        name: 'INVALID_EPIC_2',
        updaters: [
          new Updater([
            { type: 'INVALID_ACTION_1', passive: true },
            { type: 'INVALID_ACTION_2', passive: true },
          ], Function.prototype)
        ]
      });
    }).toThrow(invariantError(error('noPassiveUpdaters', 'INVALID_EPIC_2', 0)));
  });

  it("on invalid conditions", function() {
    expect(() => {
      EpicStore.register({
        name: 'INVALID_EPIC_3',
        updaters: [new Updater([{ type: true }], Function.prototype)]
      });
    }).toThrow(invariantError(error('invalidConditionType', 'INVALID_EPIC_3', 0, 0)));

    expect(() => {
      EpicStore.register({
        name: 'INVALID_EPIC_4',
        updaters: [new Updater([{ type: 'INVALID_ACTION_3', selector: 'id' }], Function.prototype)]
      });
    }).toThrow(invariantError(error('invalidConditionSelector', 'INVALID_EPIC_4', 0, 'INVALID_ACTION_3')));
  });

  it("on dispatching inside epic listener", function() {
    EpicStore.register({
      name: 'INVALID_EPIC_5',
      state: { counter: 1 },
      updaters: [
        new Updater(['INVALID_ACTION_4'], ([], { state }) => ({
          state: { counter: state.counter + 1 }
        }))
      ]
    });

    EpicStore.addListener(['INVALID_EPIC_5'], ([{ counter }]) => {
      EpicStore.dispatch({ type: 'INVALID_ACTION_1' });
    });

    expect(() => {
      EpicStore.dispatch({ type: 'INVALID_ACTION_4' });
    }).toThrow([invariantError(error('noDispatchInEpicListener'))]);
  });

  it("on changing state type from array to object", function () {
    const epic = makeEpic();
    const action = makeAction();
    EpicStore.register(new Epic(epic, [1, 2, 3], null, [
      new Updater([action], function ($0, { state }) {
        return { state: { a: 2 } };
      })
    ]));
    expect(() => {
      EpicStore.dispatch(action);
    }).toThrow(invariantError(error('invalidHandlerUpdate', epic, 0)));
  });

  it("on changing state type from primitive to object", function () {
    const epic = makeEpic();
    const action = makeAction();
    EpicStore.register(new Epic(epic, 1, null, [
      new Updater([action], function ($0, { state }) {
        return { state: { a: 2 } };
      })
    ]));
    expect(() => {
      EpicStore.dispatch(action);
    }).toThrow(invariantError(error('invalidHandlerUpdate', epic, 0)));
  });

  it("on epic as external action", function () {
    const epic1 = makeEpic();
    const epic2 = makeEpic();
    const action = makeAction();
    EpicStore.register(makeCounterEpic(epic1, action));
    EpicStore.register(makeCounterEpic(epic2, action));
    expect(() => {
      EpicStore.dispatch(epic1);
    }).toThrow(invariantError(error('invalidEpicAction', epic1)));
  });

  it("on cyclic external action", function () {
    const epic = makeEpic();
    const action = makeAction();
    EpicStore.register(makeCounterEpic(epic, action, {
      actionsToDispatch: [action]
    }));
    expect(() => {
      EpicStore.dispatch(action);
    }).toThrow(invariantError(error('noRepeatedExternalAction', action)));
  });
});
