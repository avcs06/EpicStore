import { isArray } from './object';
import { InputAction } from './Action';
import { ResolvableCondition, AnyCondition } from './Condition';

export interface EpicHandlerResponse {
    state?: any;
    scope?: any;
    actions?: InputAction[];
    passive?: boolean;
}

export interface EpicHandler {
    (values: any, metadata?: any): EpicHandlerResponse;
}

export interface Updater {
    epic?: string;
    name: string | number;
    handler: EpicHandler;
    conditions: AnyCondition[];
}

export const makeUpdater =
    (condition: AnyCondition | ResolvableCondition, handler: EpicHandler): Updater => {
        let isObjectFormat = false, isArrayFormat = false, isSoloFormat = false;
        let indexedKeys = [], inputConditions;

        if ((condition as ResolvableCondition).__ricochet_resolve) {
            delete (condition as ResolvableCondition).__ricochet_resolve;
            if (isArray(condition)) {
                isArrayFormat = true;
                inputConditions = condition;
            } else {
                isObjectFormat = true;
                indexedKeys = Object.keys(condition);
                inputConditions = indexedKeys.map(key => condition[key]);
            }
        } else {
            isSoloFormat = true;
            inputConditions = [condition as AnyCondition];
        }

        return {
            name: handler.name || "anonymous",
            conditions: inputConditions,
            handler: (values, metadata) => {
                let outputValues;
                switch (true) {
                    case isSoloFormat:
                        outputValues = values[0]
                        break;

                    case isArrayFormat:
                        outputValues = values
                        break;

                    case isObjectFormat:
                        outputValues = values.reduce((a, c, i) =>
                            Object.assign(a, { [indexedKeys[i]]: c }), {});
                        break;
                }

                return handler.bind(this)(outputValues, metadata);
            }
        };
    };
