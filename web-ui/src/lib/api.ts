import type { Api } from "@engine/api"
import {
    apiAuthenticate,
    apiDeleteHost,
    apiGetHost,
    apiGetHosts,
    apiGetRole,
    apiGetApps,
    apiGetUser,
    apiHostCancel,
    apiLogin,
    apiLogout,
    apiPatchHost,
    apiPostHost,
    apiPostPair,
    apiPostPairCancel,
    apiWakeUp,
    FetchError,
} from "@engine/api"
import type {
    App,
    DetailedHost,
    DetailedRole,
    DetailedUser,
    PairFailReason,
    UndetailedHost,
} from "@engine/api_bindings"

export function createApi(): Api {
    return {
        host_url: `${window.location.origin}/api`,
        bearer: null,
        user: null,
        role: null,
    } as Api
}

export async function ensureAuthenticated(api: Api): Promise<boolean> {
    return await apiAuthenticate(api, false)
}

export async function login(api: Api, name: string, password: string): Promise<boolean> {
    return await apiLogin(api, { name, password })
}

export async function bootstrapRole(api: Api): Promise<DetailedRole> {
    const response = await apiGetRole(api, { id: null })
    return response.role
}

/**
 * Streams the host list: `onHosts` fires with the cached list immediately,
 * then again for every live per-host update, and the promise resolves once
 * the server has probed every host and closed the stream.
 */
export async function streamHosts(api: Api, onHosts: (hosts: UndetailedHost[]) => void): Promise<UndetailedHost[]> {
    const stream = await apiGetHosts(api)
    const seen = new Map<number, UndetailedHost>()
    const initial = stream.response
    if (initial && typeof initial !== "string") {
        for (const host of initial.hosts) {
            seen.set(host.host_id, host)
        }
    }
    onHosts([...seen.values()])
    try {
        while (true) {
            const next = await stream.next()
            if (next == null) {
                break
            }
            if (typeof next !== "string") {
                seen.set(next.host_id, next)
                onHosts([...seen.values()])
            }
        }
    } catch {
        // The request-level timeout can abort a long-lived stream; keep
        // whatever state we have collected so far.
    }
    return [...seen.values()]
}

/// Collects the streamed host list into a plain array.
export async function listHosts(api: Api): Promise<UndetailedHost[]> {
    return await streamHosts(api, () => {})
}

export async function listApps(api: Api, hostId: number): Promise<App[]> {
    return await apiGetApps(api, { host_id: hostId })
}

/** Cover-art URL for an app (cookie-authenticated static fetch). */
export function appImageUrl(hostId: number, appId: number): string {
    return `/api/app/image?host_id=${hostId}&app_id=${appId}&force_refresh=false`
}

export {
    apiDeleteHost,
    apiGetHost,
    apiGetUser,
    apiHostCancel,
    apiLogout,
    apiPatchHost,
    apiPostHost,
    apiPostPair,
    apiPostPairCancel,
    apiWakeUp,
    FetchError,
}
export type { Api, App, DetailedHost, DetailedRole, DetailedUser, PairFailReason, UndetailedHost }
