import { readHostList, writeHostList } from "./localHostMap"

/** `{ [host_id]: app_id[] }`, per-host starred apps. */
const STORAGE_KEY = "mlweb.favorites"

export function getFavoriteIds(hostId: number): number[] {
    return readHostList(STORAGE_KEY, hostId)
}

export function isFavoriteApp(hostId: number, appId: number): boolean {
    return getFavoriteIds(hostId).includes(appId)
}

/** Toggles the app's favorite state for this host and returns the new id list. */
export function toggleFavorite(hostId: number, appId: number): number[] {
    const current = getFavoriteIds(hostId)
    const next = current.includes(appId) ? current.filter(id => id !== appId) : [...current, appId]
    writeHostList(STORAGE_KEY, hostId, next)
    return next
}
