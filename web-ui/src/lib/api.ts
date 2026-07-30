import type { Api } from "@engine/api"
import {
    apiAuthenticate,
    apiGetHost,
    apiGetHosts,
    apiGetRole,
    apiGetApps,
    apiLogin,
    apiPostPair,
    apiPostPairCancel,
} from "@engine/api"
import type { App, DetailedHost, DetailedRole, UndetailedHost } from "@engine/api_bindings"

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

/// Collects the streamed host list into a plain array.
export async function listHosts(api: Api): Promise<UndetailedHost[]> {
    const stream = await apiGetHosts(api)
    const seen = new Map<number, UndetailedHost>()
    const initial = stream.response
    if (initial && typeof initial !== "string") {
        for (const host of initial.hosts) {
            seen.set(host.host_id, host)
        }
    }
    // Live updates follow the initial payload; read until the server closes.
    while (true) {
        const next = await stream.next()
        if (next == null) {
            break
        }
        if (typeof next !== "string") {
            seen.set(next.host_id, next)
        }
    }
    return [...seen.values()]
}

export async function listApps(api: Api, hostId: number): Promise<App[]> {
    return await apiGetApps(api, { host_id: hostId })
}

export { apiGetHost, apiPostPair, apiPostPairCancel }
export type { Api, App, DetailedHost, UndetailedHost }

// ---- Admin surface (admin.html) — additive re-exports only ----
export {
    apiGetUser,
    apiGetUsers,
    apiPostUser,
    apiPatchUser,
    apiDeleteUser,
    apiGetRole,
    apiGetRoles,
    apiPostRole,
    apiPatchRole,
    apiDeleteRole,
    apiLogout,
    FetchError,
} from "@engine/api"
export type {
    DetailedRole,
    DetailedUser,
    UndetailedRole,
    RoleType,
    StreamPermissions,
    PostUserRequest,
    PatchUserRequest,
    PostRoleRequest,
    PatchRoleRequest,
} from "@engine/api_bindings"
