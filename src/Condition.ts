import { Epic } from './Epic';
import { isArray } from './object-utils';

type InputType = string | Epic;
type EpicConditionArgs = [(Function | boolean)?, boolean?, boolean?];
type UserConditionArgs = [(Function | boolean | EpicConditionArgs)?, boolean?];

export class UserCondition {
    type: InputType;
    selector?: Function = s => s;
    required?: boolean;

    constructor(type: InputType, ...args: UserConditionArgs) {
        this.type = type;

        const kArgs = isArray(args[0]) ? args[0] as EpicConditionArgs : args;
        if (typeof kArgs[0] === 'function')
            this.selector = kArgs.shift() as Function;

        this.required = Boolean(kArgs.shift());
    }
}

export class EpicCondition extends UserCondition {
    passive?: boolean;

    constructor(type: InputType, ...args: EpicConditionArgs) {
        super(type, args);
        this.passive = Boolean(args[0]);
    }
}

// Helpers to make changes to exisitng conditions, should return new condition
export type AnyCondition = EpicCondition | UserCondition;
export type InputCondition = InputType | AnyCondition;

const getCondition = (condition: InputCondition): AnyCondition =>
    (typeof condition === 'string' || condition instanceof Epic) ?
        { type: condition } : { ...condition };

const updateCondition = (condition: InputCondition, change: Object): AnyCondition =>
    Object.assign(getCondition(condition), change);

export const passive = (condition: InputCondition): EpicCondition =>
    updateCondition(condition, { passive: true });

export const required = (condition: InputCondition): AnyCondition =>
    updateCondition(condition, { required: true });

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
