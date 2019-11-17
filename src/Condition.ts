import { Epic } from './Epic';
import { INITIAL_VALUE } from './object-utils';
type InputType = string | Epic;

interface ConditionOptions {
    required?: boolean;
}

class Condition {
    type: InputType;
    selector?: Function = s => s;
    required?: boolean;

    constructor(type: InputType, args: [Function | ConditionOptions, ConditionOptions?]) {
        this.type = type;

        if (typeof args[0] === 'function')
            this.selector = args.shift() as Function;

        this.required = Boolean((args[0] as ConditionOptions)?.required);
    }
}

interface EpicConditionOptions extends ConditionOptions{
    passive?: boolean;
}

export class EpicCondition extends Condition {
    passive?: boolean;

    constructor(type: InputType, options?: EpicConditionOptions)
    constructor(type: InputType, selector?: Function, options?: EpicConditionOptions)
    constructor(type: InputType, ...args: [Function | EpicConditionOptions, EpicConditionOptions?]) {
        super(type, args);
        this.passive = Boolean((args[0] as EpicConditionOptions)?.passive);
    }
}

interface UserConditionOptions extends ConditionOptions {
    value?: any;
}

export class UserCondition extends Condition {
    value?: any;

    constructor(type: InputType, options?: UserConditionOptions)
    constructor(type: InputType, selector?: Function, options?: UserConditionOptions)
    constructor(type: InputType, ...args: [Function | UserConditionOptions, UserConditionOptions?]) {
        super(type, args);
        const { value = INITIAL_VALUE } = (args[0] || {}) as UserConditionOptions;
        this.value = value;
    }
}

// Helpers to make small changes to exisitng conditions, should return new condition
export type AnyCondition = EpicCondition | UserCondition;
export type InputCondition = InputType | AnyCondition;

type InputUserCondition = InputType | UserCondition;
type InputEpicCondition = InputType | EpicCondition;

const getCondition = (condition: InputCondition): AnyCondition =>
    (typeof condition === 'string' || condition instanceof Epic) ?
        { type: condition } : { ...condition };

const updateCondition = (condition: InputCondition, change: Object): AnyCondition =>
    Object.assign(getCondition(condition), change);

export const passive = (condition: InputEpicCondition): EpicCondition =>
    updateCondition(condition, { passive: true });

export const required = (condition: InputCondition): AnyCondition =>
    updateCondition(condition, { required: true });

export const withValue = (condition: InputUserCondition, value: any): UserCondition =>
    updateCondition(condition, { value });

export const withSelector = (condition: InputCondition, selector: Function): AnyCondition =>
    updateCondition(condition, { selector });

// Helpers for combining multiple conditions
export interface AnyOfCondition {
    __ricochet_anyOf: boolean;
    [index: number]: InputCondition;
}

export const anyOf = (...conditions: InputCondition[]): AnyOfCondition =>
    Object.assign(conditions as AnyCondition[], { __ricochet_anyOf: true });

export interface ResolvableCondition {
    __ricochet_resolve: boolean;
    [key: string]: InputCondition | boolean;
    [index: number]: InputCondition;
}

export const resolve = (conditions: InputCondition[] | { [key: string]: InputCondition }): ResolvableCondition =>
    Object.assign(conditions, { __ricochet_resolve: true });
