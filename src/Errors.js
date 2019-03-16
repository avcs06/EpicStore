export default {
    invalidEpicState: 'Invalid type: Epic.state (if provided) should be of type object',
    invalidEpicScope: 'Invalid type: Epic.scope (if provided) should be of type object',
    invalidConditionType: 'Invalid Type: Condition.type should be of type string',
    invalidConditionSelector: 'Invalid Type: Condition.selector (if provided) should be of type function',
    duplicateEpic: 'Epic with same name is already registered',
    noPassiveUpdaters: 'Updaters should have atleast one non passive condition',
    noDispatchInEpicListener: 'Epic listeners should not dispatch new Actions'
};
