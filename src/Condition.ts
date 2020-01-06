import { EpicLike } from './types';
type InputType = string | EpicLike;

export class Condition {
    type: string;
    selector?: Function;
    readonly?: boolean;

    constructor(type: InputType, ...args: [(Function | boolean)?, boolean?]) {
        this.type = (type as EpicLike).name || (type as string);

        if (typeof args[0] === 'function')
            this.selector = args.shift() as Function;

        this.readonly = Boolean(args[0]);
    }
}

export type SingleCondition = InputType | Condition;
export type AnyOfCondition = Array<SingleCondition>;
export type AnyCondition = SingleCondition | AnyOfCondition;
export const anyOf = (...conditions: AnyOfCondition): AnyOfCondition => conditions;

type ResolvableInput = AnyCondition[] | { [key: string]: AnyCondition };

interface Resolvable { __ricochet_resolve: boolean; }
export type ResolvableCondition =
    AnyCondition[] & Resolvable | { [key: string]: AnyCondition } & Resolvable;

export const resolve =
    (conditions: ResolvableInput): ResolvableCondition =>
        Object.assign(conditions, { __ricochet_resolve: true });

// Condition Composers
export const getConditionFrom = (condition: SingleCondition): Condition =>
    typeof condition === 'string' ? { type: condition as string } :
        (condition as EpicLike).name ? { type: (condition as EpicLike).name} :
            { ...(condition as Condition) };

export const readonly = (condition: SingleCondition): Condition =>
    Object.assign(getConditionFrom(condition), { readonly: true });

export const withSelector = (condition: SingleCondition, selector: Function): Condition =>
    Object.assign(getConditionFrom(condition), { selector });
