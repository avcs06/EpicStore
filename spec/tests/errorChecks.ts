import { Store, Epic, resolve, readonly, anyOf } from '../../src';
import { ErrorMessages, RicochetError } from '../../src/errors';
import { makeEpic, makeAction, makeCounterEpic } from '../helpers/makeEpic';
const EpicStore = new Store();

const invariantError = message => {
  const error = new Error(message);
  error.name = 'Invariant Violation';
  return error;
};

describe("Invalid Entries: should throw error", function() {
  it("on duplicate epic name", function() {
    const epic1 = makeEpic();
    const errorMessage = new RicochetError(epic1).get(ErrorMessages.duplicateEpic);

    EpicStore.register(new Epic(epic1));
    expect(() => {
      EpicStore.register(new Epic(epic1));
    }).toThrow(invariantError(errorMessage));
  });

  it("on all readonly conditions", function() {
    const epic = new Epic(makeEpic());
    epic.on(resolve([readonly(makeAction()), readonly(makeAction())]), () => {});
    const errorMessage = new RicochetError(epic.name, 'Listener[0]').get(ErrorMessages.noReadonlyUpdaters);

    expect(() => {
      EpicStore.register(epic);
    }).toThrow(invariantError(errorMessage));
  });

  it("on readonly pattern condition", function () {
    const epic = new Epic(makeEpic());
    epic.on(resolve([readonly('PATTERN_*')]), () => { });
    const errorMessage = new RicochetError(epic.name, 'Listener[0]').get(ErrorMessages.invalidPattern);

    expect(() => {
      EpicStore.register(epic);
    }).toThrow(invariantError(errorMessage));
  });

  it("on readonly anyof condition", function () {
    const epic = new Epic(makeEpic());
    epic.on(resolve([anyOf(readonly(makeAction()))]), () => { });
    const errorMessage = new RicochetError(epic.name, 'Listener[0]').get(ErrorMessages.invalidAnyOf);

    expect(() => {
      EpicStore.register(epic);
    }).toThrow(invariantError(errorMessage));
  });

  it("on any pattern anyof condition", function () {
    const epic = new Epic(makeEpic());
    epic.on(resolve([anyOf('*')]), () => { });
    const errorMessage = new RicochetError(epic.name, 'Listener[0]').get(ErrorMessages.invalidAnyOf);

    expect(() => {
      EpicStore.register(epic);
    }).toThrow(invariantError(errorMessage));
  });

  it("on dispatching inside epic listener", function() {
    const action1 = makeAction();
    const epic = new Epic(makeEpic(), { counter: 1 });
    epic.on(action1, () => ({
      state: { counter: epic.state.counter + 1 }
    }));

    EpicStore.register(epic);
    EpicStore.on(epic.name, function epicListener1 () {
      EpicStore.dispatch({ type: 'INVALID_ACTION_1' });
    });

    expect(() => {
      EpicStore.dispatch(action1);
    }).toThrow([invariantError(new RicochetError('epicListener1').get(ErrorMessages.noDispatchInEpicListener))]);
  });

  it("on dispatching inside epic handler", function () {
    const action1 = makeAction();
    const epic = new Epic(makeEpic(), { counter: 1 });
    epic.on(action1, function epicHandler1() {
      EpicStore.dispatch(makeAction());

      return {
        state: { counter: epic.state.counter + 1 }
      };
    });

    EpicStore.register(epic);
    expect(() => {
      EpicStore.dispatch(action1);
    }).toThrow(invariantError(new RicochetError(epic.name, 'epicHandler1').get(ErrorMessages.noDispatchInEpicUpdater)));
  });

  it("on changing state type", function () {
    const epic = new Epic(makeEpic(), [1, 2, 3]);
    const action = makeAction();
    epic.on(action, () => ({ state: { a: 2 } }));
    EpicStore.register(epic);

    expect(() => {
      EpicStore.dispatch(action);
    }).toThrow(invariantError(new RicochetError(epic.name, 'Listener[0]').get(ErrorMessages.invalidHandlerUpdate)));
  });

  it("on epic as external action", function () {
    const epic1 = makeEpic();
    const epic2 = makeEpic();
    const action = makeAction();
    EpicStore.register(makeCounterEpic(epic1, action));
    EpicStore.register(makeCounterEpic(epic2, action));
    expect(() => {
      EpicStore.dispatch(epic1);
    }).toThrow(invariantError(new RicochetError(epic1).get(ErrorMessages.invalidEpicAction)));
  });

  /* it("on cyclic external action", function () {
    const epic = makeEpic();
    const action = makeAction();

    EpicStore.register(makeCounterEpic(epic, action, {
      actionsToDispatch: [action] }));

    expect(() => {
      EpicStore.dispatch(action);
    }).toThrow(invariantError(new RicochetError(action).get(ErrorMessages.noRepeatedExternalAction)));
  }); */
});
