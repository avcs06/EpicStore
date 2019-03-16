import EpicManager from '../../src/EpicManager';
import Updater from '../../src/Updater';
import Errors from '../../src/Errors';

const invariantError = message => {
  const error = new Error(message);
  error.name = 'Invariant Violation';
  return error;
};

describe("Invalid Entries: should throw error ", function() {
  it("on duplicate epic name", function() {
    EpicManager.register({ name: 'Epic1' });
    expect(() => {
      EpicManager.register({ name: 'Epic1' });
    }).toThrow(invariantError(Errors.duplicateEpic));
  });

  it("if no active listeners are passed", function () {
    expect(() => {
      EpicManager.register({
        name: 'Epic2',
        updaters: [
          new Updater([
            { type: 'ACTION_1', passive: true },
            { type: 'ACTION_2', passive: true },
          ], Function.prototype)
        ]
      });
    }).toThrow(invariantError(Errors.noPassiveUpdaters));
  });

  it("on invalid conditions", function () {
    expect(() => {
      EpicManager.register({
        name: 'Epic3',
        updaters: [
          new Updater([
            { type: true },
          ], Function.prototype)
        ]
      });
    }).toThrow(invariantError(Errors.invalidConditionType));

    expect(() => {
      EpicManager.register({
        name: 'Epic4',
        updaters: [
          new Updater([
            { type: 'ACTION_1', selector: 'id' },
          ], Function.prototype)
        ]
      });
    }).toThrow(invariantError(Errors.invalidConditionSelector));
  });

  it("on dispatching inside epic listener", function () {
    EpicManager.register({
      name: 'Epic5',
      state: { counter: 1 },
      updaters: [
        new Updater(['ACTION_1'], ([], { state }) => ({
          state: state.counter + 1
        }))
      ]
    });

    EpicManager.addListener(['Epic5'], ([ { counter } ]) => {
      console.log(counter);
      EpicManager.dispatch({ type: 'ACTION_1' });
    });

    expect(() => {
      EpicManager.dispatch({ type: 'ACTION_1' });
    }).toThrow(invariantError(Errors.noDispatchInEpicListener));
  });
});
