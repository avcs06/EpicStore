import type { Epic, Store } from './types'
const epicStoreMap: Map<Epic, Set<Store>> = new Map()

export const registerStoreToEpic = (epic: Epic, store: Store) => {
    if (!epicStoreMap.has(epic)) epicStoreMap.set(epic, new Set())
    epicStoreMap.get(epic).add(store)
}

export const unregisterStoreFromEpic = (epic: Epic, store: Store) => {
    const stores = epicStoreMap.get(epic)
    stores.delete(store)
    if (!stores.size) epicStoreMap.delete(epic)
}

export const getStoresForEpic = (epic:Epic): Set<Store> | Store[] => {
    return epicStoreMap.get(epic) || []
}
