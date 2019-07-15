import EpicManager from '../../src/EpicManager';
import Updater from '../../src/Updater';
import { error } from '../../src/Errors';
import Epic from '../../src/Epic';
import { makeGetter, makeCounterEpic } from '../helpers/makeEpic';

const make = makeGetter('errorchecks');
const makeEpic = make('epic');
const makeAction = make('action');
const invariantError = message => {
  const error = new Error(message);
  error.name = 'Invariant Violation';
  return error;
};

describe("Invalid Entries: should throw error", function() {
  it("on duplicate epic name", function() {
    EpicManager.register({ name: 'INVALID_EPIC_1' });
    expect(() => {
      EpicManager.register({ name: 'INVALID_EPIC_1' });
    }).toThrow(invariantError(error('duplicateEpic', 'INVALID_EPIC_1')));
  });

  it("if no active listeners are passed", function() {
    expect(() => {
      EpicManager.register({
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
      EpicManager.register({
        name: 'INVALID_EPIC_3',
        updaters: [
          new Updater([
            { type: true },
          ], Function.prototype)
        ]
      });
    }).toThrow(invariantError(error('invalidConditionType', 'INVALID_EPIC_3', 0, 0)));

    expect(() => {
      EpicManager.register({
        name: 'INVALID_EPIC_4',
        updaters: [
          new Updater([
            { type: 'INVALID_ACTION_3', selector: 'id' },
          ], Function.prototype)
        ]
      });
    }).toThrow(invariantError(error('invalidConditionSelector', 'INVALID_EPIC_4', 0, 'INVALID_ACTION_3')));
  });

  it("on dispatching inside epic listener", function() {
    EpicManager.register({
      name: 'INVALID_EPIC_5',
      state: { counter: 1 },
      updaters: [
        new Updater(['INVALID_ACTION_4'], ([], { state }) => ({
          state: {
            counter: state.counter + 1
          }
        }))
      ]
    });

    EpicManager.addListener(['INVALID_EPIC_5'], ([{ counter }]) => {
      EpicManager.dispatch({ type: 'INVALID_ACTION_1' });
    });

    expect(() => {
      EpicManager.dispatch({ type: 'INVALID_ACTION_4' });
    }).toThrow([invariantError(error('noDispatchInEpicListener'))]);
  });

  it("on changing state type from array to object", function () {
    const epic = makeEpic();
    const action = makeAction();
    EpicManager.register(new Epic(epic, [1, 2, 3], null, [
      new Updater([action], function ($0, { state }) {
        return { state: { a: 2 } };
      })
    ]));
    expect(() => {
      EpicManager.dispatch(action);
    }).toThrow(invariantError(error('invalidHandlerUpdate', epic, 0)));
  });

  it("on changing state type from primitive to object", function () {
    const epic = makeEpic();
    const action = makeAction();
    EpicManager.register(new Epic(epic, 1, null, [
      new Updater([action], function ($0, { state }) {
        return { state: { a: 2 } };
      })
    ]));
    expect(() => {
      EpicManager.dispatch(action);
    }).toThrow(invariantError(error('invalidHandlerUpdate', epic, 0)));
  });

  it("on optional + passive condition", function () {
    const epic = makeEpic();
    const action = makeAction();
    expect(() => {
      EpicManager.register(makeCounterEpic(epic, { type: action, passive: true, optional: true }));
    }).toThrow(invariantError(error('invalidConditionOP', epic, 0, action)));
  });

  it("on epic as external action", function () {
    const epic1 = makeEpic();
    const epic2 = makeEpic();
    const action = makeAction();
    EpicManager.register(makeCounterEpic(epic1, action));
    EpicManager.register(makeCounterEpic(epic2, action));
    expect(() => {
      EpicManager.dispatch(epic1);
    }).toThrow(invariantError(error('invalidEpicAction', epic1)));
  });

  it("on cyclic external action", function () {
    const epic = makeEpic();
    const action = makeAction();
    EpicManager.register(makeCounterEpic(epic, action, {
      actionsToDispatch: [action]
    }));
    expect(() => {
      EpicManager.dispatch(action);
    }).toThrow(invariantError(error('noRepeatedExternalAction', action)));
  });
});
