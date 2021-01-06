import { isArray } from './object'
import { isResolvableCondition, unResolveCondition } from './condition'

import type {
    Reducer, ReducerHandler,
    ResolvableCondition, AnyCondition, ReducerCondition
} from './types'

export const makeUpdater = (condition: ReducerCondition, handler: ReducerHandler): Reducer => {
    let isObjectFormat = false; let isArrayFormat = false; let isSoloFormat = false
    let indexedKeys = []; let inputConditions

    if (isResolvableCondition((condition as ResolvableCondition))) {
        unResolveCondition(condition as ResolvableCondition)
        if (isArray(condition)) {
            isArrayFormat = true
            inputConditions = condition
        } else {
            isObjectFormat = true
            indexedKeys = Object.keys(condition)
            inputConditions = indexedKeys.map(key => condition[key])
        }
    } else {
        isSoloFormat = true
        inputConditions = [condition as AnyCondition]
    }

    return {
        name: handler.name || 'anonymous',
        conditions: inputConditions,
        handler: function (values, metadata) {
            let outputValues
            switch (true) {
            case isSoloFormat:
                outputValues = values[0]
                break

            case isArrayFormat:
                outputValues = values
                break

            case isObjectFormat:
                outputValues = values.reduce((a, c, i) =>
                    Object.assign(a, { [indexedKeys[i]]: c }), {})
                break
            }

            return handler.bind(this)(outputValues, metadata)
        }
    }
}
