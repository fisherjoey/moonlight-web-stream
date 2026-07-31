/**
 * Shared plumbing for the small per-host localStorage maps ({ [host_id]:
 * number[] }) backing favorites and recents. Keeps read/parse/write
 * failures (private browsing, quota, corrupt JSON) contained to one place.
 */

type HostMap = Record<string, number[]>

function readMap(storageKey: string): HostMap {
    try {
        const raw = localStorage.getItem(storageKey)
        if (!raw) {
            return {}
        }
        const parsed = JSON.parse(raw)
        return parsed != null && typeof parsed === "object" ? parsed : {}
    } catch {
        return {}
    }
}

function writeMap(storageKey: string, map: HostMap) {
    try {
        localStorage.setItem(storageKey, JSON.stringify(map))
    } catch {
        // Storage unavailable or full — the feature degrades to "doesn't persist".
    }
}

export function readHostList(storageKey: string, hostId: number): number[] {
    return readMap(storageKey)[String(hostId)] ?? []
}

export function writeHostList(storageKey: string, hostId: number, ids: number[]) {
    const map = readMap(storageKey)
    map[String(hostId)] = ids
    writeMap(storageKey, map)
}
