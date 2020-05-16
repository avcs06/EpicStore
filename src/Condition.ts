import { EpicLike } from './types';
type InputType = string | EpicLike;

interface ConditionOptions {
    guard?: Function,
    selector?: Function,
}

export class Condition {
    type: string;
    readonly?: boolean;

    guard?: Function;
    selector?: Function;

    constructor(type: InputType, readonly?: boolean | ConditionOptions, options?: ConditionOptions) {
        this.type = (type as EpicLike).name || (type as string);
        if (typeof readonly === 'object') {
            options = readonly;
            readonly = false;
        }
        this.readonly = readonly;
        Object.assign(this, options || {});
    }
}

export type SingleCondition = InputType | Condition;

// AnyOf Condition utils
export type AnyOfCondition = SingleCondition[];

export const anyOf = (...conditions: SingleCondition[]): AnyOfCondition => conditions;

export type AnyCondition = SingleCondition | AnyOfCondition;

// resolvable condition utils
type ResolvableInput = AnyCondition[] | { [key: string]: AnyCondition };

interface Resolvable { __ricochet_resolve: boolean; }

export type ResolvableCondition =
    AnyCondition[] & Resolvable | { [key: string]: AnyCondition } & Resolvable;

export const resolve =
    (conditions: ResolvableInput): ResolvableCondition =>
        Object.assign(conditions, { __ricochet_resolve: true });

export const isResolvableCondition = ({ __ricochet_resolve }) => __ricochet_resolve;

export const unResolveCondition = (condition: ResolvableCondition) =>
    delete condition.__ricochet_resolve;

// Condition Composers
export const getConditionFrom = (condition: SingleCondition): Condition =>
    typeof condition === 'string' ? { type: condition as string } :
        (condition as EpicLike).name ? { type: (condition as EpicLike).name} :
            { ...(condition as Condition) };

export const readonly = (condition: SingleCondition): Condition =>
    Object.assign(getConditionFrom(condition), { readonly: true });

export const withSelector = (condition: SingleCondition, selector: Function): Condition =>
    Object.assign(getConditionFrom(condition), { selector });

export const withGuard = (condition: SingleCondition, guard: Function): Condition =>
    Object.assign(getConditionFrom(condition), { guard });
