import { EpicLike } from './types';

interface ActionOptions {
    createUndoPoint?: boolean,
    target?: string | EpicLike
}

export class Action {
    type: string;
    payload?: any;
    target?: string | EpicLike;
    createUndoPoint?: boolean;

    constructor(type: string, payload?: any, options?: ActionOptions) {
        this.type = type;
        this.payload = payload;
        this.target = options?.target;
        this.createUndoPoint = Boolean(options?.createUndoPoint);
    }
}

export type InputAction = string | Action;

// Action Composers
export const getActionFrom = (action: InputAction): Action =>
    typeof action === 'string' ? { type: action } : { ...action };

export const withPayload = (action: InputAction, payload: any): Action =>
    Object.assign(getActionFrom(action), { payload });

export const withTarget = (action: InputAction, target: string | EpicLike): Action =>
    Object.assign(getActionFrom(action), { target });

export const withUndoPoint = (action: InputAction): Action =>
    Object.assign(getActionFrom(action), { createUndoPoint: true });
