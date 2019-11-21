export const ErrorMessages = {
    duplicateEpic: 'Epic: [0] -> Epic with same name is already registered',
    noPassiveUpdaters: 'Epic: [0], Updater: [1] -> Updaters should have atleast one non passive condition',
    noDispatchInEpicListener: 'Epic listeners should not dispatch actions',
    invalidHandlerUpdate: 'Epic: [0], Updater: [1] -> Updater Handler should not change the type of state or scope',
    invalidEpicAction: 'A registered Epic: [0] cannot be dispatched as an external action',
    noRepeatedExternalAction: 'An external action of type: [0] has already been dispatched during the current Epic Cycle'
};

export class Error {
    epic?: string;
    updater?: string | number;
    condition?: string | number;

    constructor(epic, updater?, condition?) {
        this.epic = epic;
        this.updater = updater;
        this.condition = condition;
    }

    throw(error) {
        return [this.epic, this.updater, this.condition].reduce((a, c, i) => a.replace('[' + i + ']', c), error);
    }
};
