import { Epic } from './Epic';

interface ActionOptions {
    createUndoPoint?: boolean,
    target?: string | Epic
}

export class Action {
    type: string;
    payload?: any;
    target?: ActionOptions["target"];
    createUndoPoint?: boolean;

    constructor(type: string, payload?: any, options?: ActionOptions) {
        this.type = type;
        this.payload = payload;
        this.target = options?.target;
        this.createUndoPoint = Boolean(options?.createUndoPoint);
    }
}

type InputAction = string | Action;

const getAction = (action: InputAction): Action =>
    typeof action === 'object' ? action : { type: action };

export const withPayload = (action: InputAction, payload: any): Action =>
    Object.assign(getAction(action), { payload });

export const withTarget = (action: InputAction, target: string | Epic): Action =>
    Object.assign(getAction(action), { target });

export const withUndoPoint = (action: InputAction): Action =>
    Object.assign(getAction(action), { createUndoPoint: true });
