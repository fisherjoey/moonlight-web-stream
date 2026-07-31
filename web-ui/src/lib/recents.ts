import { readHostList, writeHostList } from "./localHostMap"

/** `{ [host_id]: app_id[] }`, most-recently-launched first, per host. */
const STORAGE_KEY = "mlweb.recents"
const MAX_RECENTS = 5

export function getRecentIds(hostId: number): number[] {
    return readHostList(STORAGE_KEY, hostId)
}

/** Records a launch and returns the updated (most-recent-first, deduped, capped) id list. */
export function recordRecent(hostId: number, appId: number): number[] {
    const current = getRecentIds(hostId)
    const next = [appId, ...current.filter(id => id !== appId)].slice(0, MAX_RECENTS)
    writeHostList(STORAGE_KEY, hostId, next)
    return next
}
