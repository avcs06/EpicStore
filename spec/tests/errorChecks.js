import EpicManager from '../../src/EpicManager';
import Updater from '../../src/Updater';
import Errors from '../../src/Errors';

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
    }).toThrow(invariantError(Errors.duplicateEpic));
  });

  it("if no active listeners are passed", function () {
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
    }).toThrow(invariantError(Errors.noPassiveUpdaters));
  });

  it("on invalid conditions", function () {
    expect(() => {
      EpicManager.register({
        name: 'INVALID_EPIC_3',
        updaters: [
          new Updater([
            { type: true },
          ], Function.prototype)
        ]
      });
    }).toThrow(invariantError(Errors.invalidConditionType));

    expect(() => {
      EpicManager.register({
        name: 'INVALID_EPIC_4',
        updaters: [
          new Updater([
            { type: 'INVALID_ACTION_3', selector: 'id' },
          ], Function.prototype)
        ]
      });
    }).toThrow(invariantError(Errors.invalidConditionSelector));
  });

  it("on dispatching inside epic listener", function () {
    debugger;
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

    EpicManager.addListener(['INVALID_EPIC_5'], ([ { counter } ]) => {
      EpicManager.dispatch({ type: 'INVALID_ACTION_1' });
    });

    expect(() => {
      EpicManager.dispatch({ type: 'INVALID_ACTION_4' });
    }).toThrow([invariantError(Errors.noDispatchInEpicListener)]);
  });

  it("on invalid epics", function() {
    expect(() => {
      EpicManager.register({ name: 'INVALID_EPIC_6', state: null });
    }).toThrow(invariantError(Errors.invalidEpicState));
    expect(() => {
      EpicManager.register({ name: 'INVALID_EPIC_7', scope: null });
    }).toThrow(invariantError(Errors.invalidEpicScope));
  });
});
