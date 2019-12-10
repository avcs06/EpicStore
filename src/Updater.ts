import { isArray } from './object';
import { ResolvableCondition, AnyCondition } from './Condition';

export interface EpicHandlerResponse {
    state?: any;
    scope?: any;
}

export interface EpicHandler {
    (values: any, any): EpicHandlerResponse;
}

export interface Updater {
    id: number;
    epic?: string;
    name: string | number;
    handler: EpicHandler;
    conditions: AnyCondition[];
}

export const makeUpdater = (() => {
    let counter = 0;

    return (condition: AnyCondition | ResolvableCondition, handler: EpicHandler): Updater => {
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
            id: counter++,
            name: handler.name || "anonymous",
            conditions: inputConditions,
            handler: (values, ...args) => {
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

                return handler.bind(this)(outputValues, ...args);
            }
        };
    };
})();