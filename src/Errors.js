export default {
    invalidConditionType: 'Invalid Type: Condition.type should be of type string',
    invalidConditionSelector: 'Invalid Type: Condition.selector (if provided) should be of type function',
    duplicateEpic: 'Epic with same name is already registered',
    noPassiveUpdaters: 'Updaters should have atleast one non passive condition',
    noDispatchInEpicListener: 'Epic listeners should not dispatch new Actions',
    invalidHandlerUpdate: 'Updater Handler should not change the type of state or scope, when their initial value is of type Object'
};
