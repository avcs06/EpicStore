import { Action } from './Action';
import { ResolvableCondition, InputCondition } from './Condition';
import { INITIAL_VALUE, isArray, freeze } from './object';

interface EpicHandlerResponse {
    state?: any;
    scope?: any;
    actions?: Action[]
}

interface EpicHandler {
    (values: any): EpicHandlerResponse
}

export interface Updater {
    epic: string;
    name: string | number;
    handler: EpicHandler;
    conditions: InputCondition[];
}

export class Epic {
    name: string;
    state: any;
    scope: any;

    private _updaters: Updater[] = [];
    get updaters() {
        return this._updaters;
    }

    constructor(name, state = INITIAL_VALUE, scope = INITIAL_VALUE) {
        this.name = name;
        this.state = freeze(state === null ? INITIAL_VALUE : state);
        this.scope = freeze(scope === null ? INITIAL_VALUE : scope);
    }

    on(condition: InputCondition | ResolvableCondition, handler: EpicHandler) {
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
            inputConditions = [condition as InputCondition];
        }

        this._updaters.push({
            epic: this.name,
            name: handler.name || this._updaters.length,
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
                            Object.assign(a, { [indexedKeys[i]]: c }) , {});
                        break;
                }

                return handler.bind(this)(outputValues, ...args);
            }
        });
    }
}
