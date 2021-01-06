import { makeUpdater } from './reducer'
import { INITIAL_VALUE } from './object'
import { getStoresForEpic } from './epicStore'
import { addUpdaterToStore, removeUpdaterFromStore } from './store'

import type { Epic, Reducer, Store } from './types'

let counter = 0
export const makeEpic = (name?: string): Epic => {
    const updaters: Set<Reducer> = new Set()
    name = name || `E${counter++}`

    return {
        name,
        state: INITIAL_VALUE,
        scope: INITIAL_VALUE,

        get reducers () {
            return [...updaters]
        },

        useReducer (condition, handler) {
            const stores = getStoresForEpic(this)
            const updater = makeUpdater(condition, handler)
            updater.name = updater.name === 'anonymous'
                ? `R[${updaters.size}]`
                : updater.name
            updater.epic = name

            updaters.add(updater)
            stores.forEach((store: Store) => {
                addUpdaterToStore(store, updater)
            })

            return () => {
                this._updaters.delete(updater)
                stores.forEach((store: Store) => {
                    removeUpdaterFromStore(store, updater)
                })
            }
        }
    }
}
