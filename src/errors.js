export const ErrorMessages = {
    duplicateEpic: 'Epic: [0] -> Epic with same name is already registered',

    noReadonlyUpdaters: 'Epic: [0], Updater: [1] -> Updaters should have atleast one non-readonly condition',
    invalidPattern: 'Epic: [0], Updater: [1] -> Pattern condition cannot be a readonly condition',
    invalidAnyOf: 'Epic: [0], Updater: [1] -> AnyOfCondition should not have readonly conditions or universal condition ("*")',
    invalidHandlerUpdate: 'Epic: [0], Updater: [1] -> Updater should not change the type of state or scope',

    noDispatchInEpicListener: 'StoreListener: [0] -> Store listeners should not dispatch actions',
    noDispatchInEpicUpdater: 'Epic: [0], Updater: [1] -> Epic updaters should not dispatch actions',

    invalidEpicAction: 'A registered Epic: [0] cannot be dispatched as an external action',
    // cyclicDependency: 'Cyclic dependency detected in Epic: [0], Updater: [1], Condition: [2]',
    // noRepeatedExternalAction: 'An external action of type: [0] has been dispatched more than once in a Cycle'
};

export class RicochetError {
    constructor(...args) {
        this.args = args;
    }

    get(error) {
        return this.args.reduce((a, c, i) => a.replace('[' + i + ']', c), error);
    }
};
