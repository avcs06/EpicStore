export const ErrorMessages = {
    duplicateEpic: 'Epic: [0] -> Epic with same name is already registered',

    noReadonlyUpdaters: 'Epic: [0], Reducer: [1] -> Reducers should have atleast one non-readonly condition',
    invalidPattern: 'Epic: [0], Reducer: [1] -> Pattern condition cannot be a readonly condition',
    invalidAnyOf: 'Epic: [0], Reducer: [1] -> AnyOfCondition should not have readonly conditions or universal condition ("*")',
    invalidHandlerUpdate: 'Epic: [0], Reducer: [1] -> Reducer should not change the type of state or scope',

    noReadonlyListeners: 'StoreListener: [0] -> Listeners should have atleast one non-readonly condition',
    invalidListenerPattern: 'StoreListener: [0] -> Pattern condition cannot be a readonly condition',

    noDispatchInEpicListener: 'StoreListener: [0] -> Store listeners should not dispatch actions',
    noDispatchInEpicUpdater: 'Epic: [0], Reducer: [1] -> Epic reducers should not dispatch actions',

    invalidEpicAction: 'A registered Epic: [0] cannot be dispatched as an external action',

    invalidMultipleSetState: 'Epic: [0] -> Can set Initial state for an Epic only once',
    invalidMultipleSetScope: 'Epic: [0] -> Can set Initial scope for an Epic only once'
}

export const makeError = (...args) => {
    return {
        get (error) {
            return args.reduce((a, c, i) => a.replace('[' + i + ']', c), error)
        }
    }
}
