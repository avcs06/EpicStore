import { ResolvableCondition, AnyCondition } from './Condition';
import { INITIAL_VALUE, freeze } from './object';
import { Updater, EpicHandler, makeUpdater } from './Updater';

export class Epic {
    name: string;
    state: any;
    scope: any;

    _updaters: Updater[] = [];
    private _stores: any = [];
    private _updaterhash: any = {};

    constructor(name, state = INITIAL_VALUE, scope = INITIAL_VALUE) {
        this.name = name;
        this.state = freeze(state === null ? INITIAL_VALUE : state);
        this.scope = freeze(scope === null ? INITIAL_VALUE : scope);
    }

    on(condition: AnyCondition | ResolvableCondition, handler: EpicHandler) {
        const updater = makeUpdater(condition, handler);
        updater.name = (!updater.name || updater.name === 'anonymous') ?
            `Listener[${this._updaters.length}]` : updater.name;
        updater.epic = this.name;

        this._updaters.push(updater);
        this._updaterhash[updater.id] = updater;
        this._stores.forEach(store => {
            store._addUpdater(updater);
        });

        return () => this._off(updater.id);;
    }

    private _off(id: number) {
        const updater = this._updaterhash[id];
        delete this._updaterhash[id];

        const index = this._updaters.indexOf(updater);
        if (index > -1) this._updaters.splice(index, 1);

        this._stores.forEach(store => {
            store._removeUpdater(updater);
        });
    }

    _addStore(store) {
        this._stores.push(store);
    }
}
