export const Errors = {
    invalidConditionType: 'Epic: [0], Updater: [1], Condition: [2] -> Invalid Type: Condition.type should be of type string',
    invalidConditionSelector: 'Epic: [0], Updater: [1], Condition: [2] -> Invalid Type: Condition.selector (if provided) should be of type function',
    duplicateEpic: 'Epic: [0] -> Epic with same name is already registered',
    noPassiveUpdaters: 'Epic: [0], Updater: [1] -> Updaters should have atleast one non passive condition',
    noDispatchInEpicListener: 'Epic listeners should not dispatch actions',
    invalidHandlerUpdate: 'Epic: [0], Updater: [1] -> Updater Handler should not change the type of state or scope',
    invalidEpicAction: 'A registered Epic: [0] cannot be dispatched as an external action',
    noRepeatedExternalAction: 'An external action of type: [0] has already been dispatched during the current Epic Cycle'
};

export const error = (error, ...args) => args.reduce((a, c, i) => a.replace('[' + i + ']', c), Errors[error]);
export const makeError = epic => updater => condition => errorType => error(errorType, epic, updater, condition);
