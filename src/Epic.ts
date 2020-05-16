import { ResolvableCondition, AnyCondition } from './Condition';
import { INITIAL_VALUE, freeze } from './object';
import { Updater, EpicHandler, makeUpdater } from './Updater';

export class Epic {
    name: string;
    state: any;
    scope: any;

    private _stores: Set<any> = new Set();
    private _updaters: Set<Updater> = new Set();
    get updaters() {
        return [...this._updaters];
    }

    constructor(name: string, state: any = INITIAL_VALUE, scope: any = INITIAL_VALUE) {
        this.name = name;
        this.state = freeze(state === null ? INITIAL_VALUE : state);
        this.scope = freeze(scope === null ? INITIAL_VALUE : scope);
    }

    on(condition: AnyCondition | ResolvableCondition, handler: EpicHandler) {
        const updater = makeUpdater(condition, handler);
        updater.name = updater.name === 'anonymous' ?
            `Listener[${this._updaters.size}]` : updater.name;
        updater.epic = this.name;

        this._updaters.add(updater);
        this._stores.forEach(store => {
            store._addUpdater(updater);
        });

        return () => {
            this._updaters.delete(updater);
            this._stores.forEach(store => {
                store._removeUpdater(updater);
            });
        };
    }

    _registerStore(store) {
        this._stores.add(store);
    }

    _unregisterStore(store) {
        this._stores.delete(store);
    }
}
