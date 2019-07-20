const conditionObject = condition =>
    typeof condition === 'object' ? condition : { type: condition };

export const anyOf = (...conditions) => conditions;
export const passive = condition => ({ ...conditionObject(condition), passive: true });
export const required = condition => ({ ...conditionObject(condition), required: true });
export const withValue = (condition, value) => ({ ...conditionObject(condition), value });
export const withSelector = (condition, selector) => ({ ...conditionObject(condition), selector });

export default class Condition {
    constructor(type) {
        this.type = type;
    }
};
