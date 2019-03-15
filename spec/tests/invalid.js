import EpicManager from '../../src/EpicManager';
import Updater from '../../src/Updater';

describe("Invalid Entries", function() {
  it("should throw error on duplicate epic name", function() {
    EpicManager.register({ name: 'Epic1' });
    expect(() => {
      EpicManager.register({ name: 'Epic1' });
    }).toThrow(new Error('Epic with name Epic1 is already registered'));
  });

  it("should throw error if no active listeners are passed", function () {
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
    }).toThrow(new Error('Updater[0] of epic Epic2 doesn\'t have active listeners. Updater should have atleast one non passive condition.'));
  });

  it("should throw error on invalid conditions", function () {
    expect(() => {
      EpicManager.register({
        name: 'Epic2',
        updaters: [
          new Updater([
            { type: true },
          ], Function.prototype)
        ]
      });
    }).toThrow(new Error('Missing required property: condition.type'));
  });
});
