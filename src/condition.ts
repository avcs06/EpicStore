import type {
    Epic, Condition,
    InputCondition, AnyOfCondition,
    ResolvableCondition, ResolvableInputCondition
} from './types'

export const anyOf = (...conditions: InputCondition[]): AnyOfCondition => conditions

export const resolve = (conditions: ResolvableInputCondition): ResolvableCondition => {
    return Object.assign(conditions, { __ricochet_resolve: true })
}

export const isResolvableCondition = ({ __ricochet_resolve }) => {
    return __ricochet_resolve
}

export const unResolveCondition = (condition: ResolvableCondition) => {
    delete condition.__ricochet_resolve
}

export const getConditionFrom = (condition: InputCondition): Condition => {
    if (typeof condition === 'string') {
        return { type: condition as string }
    }

    if ((condition as Epic).name) {
        return { type: (condition as Epic).name }
    }

    return { ...(condition as Condition) }
}

export const readonly = (condition: InputCondition): Condition => {
    return Object.assign(getConditionFrom(condition), { readonly: true })
}

export const withSelector = (condition: InputCondition, selector: Condition['selector']): Condition => {
    return Object.assign(getConditionFrom(condition), { selector })
}

export const withGuard = (condition: InputCondition, guard: Condition['guard']): Condition => {
    return Object.assign(getConditionFrom(condition), { guard })
}

export const fromString = (condition: InputCondition) => {
    if (typeof condition !== 'string') return condition

    let readonly = false
    if (/^readonly:/.test(condition)) {
        condition = condition.split(':')[1]
        readonly = true
    }

    let selector
    const splits = condition.split('.')
    if (splits.length > 1) {
        condition = splits.shift()
        selector = state => splits.reduce((a, c) => a[c], state)
    }

    return { type: condition, readonly, selector }
}
