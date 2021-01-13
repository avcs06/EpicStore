import type { Action, InputAction } from './types'

export const getActionFrom = (action: InputAction): Action => {
    return typeof action === 'string' ? { type: action } : { ...action }
}

export const withPayload = (action: InputAction, payload: Action['payload']): Action => {
    return Object.assign(getActionFrom(action), { payload })
}

export const withTarget = (action: InputAction, target: Action['target']): Action => {
    return Object.assign(getActionFrom(action), { target })
}

export const withUndoPoint = (action: InputAction): Action => {
    return Object.assign(getActionFrom(action), { createUndoPoint: true })
}

export const withoutUndoPoint = (action: InputAction): Action => {
    return Object.assign(getActionFrom(action), { skipUndoPoint: true })
}
