import { EpicLike } from './types';

type InputType = string | EpicLike;

interface ConditionOptions {
    required?: boolean;
    passive?: boolean;
}

export class Condition {
    type: string;
    selector?: Function;
    required?: boolean;
    passive?: boolean;

    constructor(type: InputType, ...args: [(Function | ConditionOptions)?, ConditionOptions?]) {
        this.type = (type as EpicLike).name || (type as string);

        if (typeof args[0] === 'function')
            this.selector = args.shift() as Function;

        const { required, passive } = (args[0] as ConditionOptions) || {};
        this.required = Boolean(required);
        this.passive = Boolean(passive);
    }
}

type AnyOfInputCondition =
    InputType | Omit<Condition, 'passive'>;

export interface AnyOfCondition
    extends Array<AnyOfInputCondition> {
    __ricochet_anyOf: boolean;
}

export const anyOf =
    (...conditions: AnyOfInputCondition[]): AnyOfCondition =>
        Object.assign(conditions, { __ricochet_anyOf: true });

export type SingletonInputCondition = InputType | Condition;
export type InputCondition = SingletonInputCondition | AnyOfCondition;

interface ResolvableArrayCondition
    extends Array<InputCondition> {
    __ricochet_resolve: boolean;
}

interface ResolvableObjectCondition {
    __ricochet_resolve: boolean;
    [key: string]: InputCondition | boolean
}

export type ResolvableCondition =
    ResolvableArrayCondition | ResolvableObjectCondition;

type ResolvableInputCondition =
    InputCondition[] | { [key: string]: InputCondition };

export const resolve =
    (conditions: ResolvableInputCondition): ResolvableCondition =>
        Object.assign(conditions, { __ricochet_resolve: true });

export const getConditionFrom = (condition: SingletonInputCondition): Condition =>
    typeof condition === 'string' ? { type: condition as string } :
        (condition as EpicLike).name ? { type: (condition as EpicLike).name} :
            { ...(condition as Condition) };

const updateCondition = (condition: SingletonInputCondition, change: Object): Condition =>
    Object.assign(getConditionFrom(condition), change);

export const passive = (condition: SingletonInputCondition): Condition =>
    updateCondition(condition, { passive: true });

export const required = (condition: SingletonInputCondition): Condition =>
    updateCondition(condition, { required: true });

export const withSelector = (condition: SingletonInputCondition, selector: Function): Condition =>
    updateCondition(condition, { selector });
