const conditionObject = condition =>
    typeof condition === 'object' ? condition : { type: condition };

export const anyOf = (...conditions) => conditions;
export const passive = condition => ({ ...conditionObject(condition), passive: true });
export const optional = condition => ({ ...conditionObject(condition), optional: true });
export const withSelector = (condition, selector) => ({ ...conditionObject(condition), selector });

export default class Condition {
    constructor(type, selector, passive, optional) {
        this.type = type;
        this.selector = selector;
        this.passive = Boolean(passive);
        this.optional = Boolean(optional);
    }
};
