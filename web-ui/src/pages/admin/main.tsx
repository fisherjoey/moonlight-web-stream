import { StrictMode, useCallback, useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import "../../styles.css"
import type { Api, DetailedUser, UndetailedRole } from "../../lib/api"
import {
    apiGetRoles,
    apiGetUser,
    apiGetUsers,
    apiLogout,
    createApi,
    ensureAuthenticated,
} from "../../lib/api"
import { Badge, Banner, Button, describeError, focusRing } from "./ui"
import { UsersPanel } from "./users"
import { RolesPanel } from "./roles"

const api: Api = createApi()

type Phase =
    | { kind: "loading" }
    | { kind: "signin" }
    | { kind: "forbidden", name: string }
    | { kind: "ready", self: DetailedUser }

type Tab = "users" | "roles"

const TAB_STORAGE_KEY = "mlAdminTab"

function GateScreen({ title, body }: { title: string, body: string }) {
    return (
        <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 px-6">
            <Glow />
            <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border border-line
                bg-panel p-8 text-center shadow-2xl">
                <p className="text-3xl" aria-hidden>🌘</p>
                <h1 className="text-lg font-semibold tracking-tight text-snow">{title}</h1>
                <p className="text-sm text-fog">{body}</p>
                <a href="/" className={`mt-2 inline-flex items-center justify-center rounded-lg bg-moon/90
                    px-4 py-2 text-sm font-medium text-abyss transition hover:bg-moon ${focusRing}`}>
                    Back to the console
                </a>
            </div>
        </div>
    )
}

function Glow() {
    return (
        <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 h-72
            bg-[radial-gradient(60%_100%_at_50%_0%,rgba(122,162,255,0.09),transparent)]" />
    )
}

function TopBar({ self }: { self: DetailedUser }) {
    const [signingOut, setSigningOut] = useState(false)

    async function logout() {
        setSigningOut(true)
        try {
            await apiLogout(api)
        } finally {
            window.location.href = "/"
        }
    }

    return (
        <header className="sticky top-0 z-40 border-b border-line bg-abyss/80 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-6">
                <a href="/" className={`rounded-md text-base font-semibold tracking-tight ${focusRing}`}>
                    <span className="text-moon">Moonlight</span> Web
                </a>
                <Badge tone="moon2">Admin</Badge>
                <div className="ml-auto flex items-center gap-4">
                    <span className="hidden text-sm text-fog sm:block">
                        signed in as <span className="font-medium text-snow">{self.name}</span>
                    </span>
                    <a href="/" className={`rounded-md text-sm text-fog transition hover:text-snow ${focusRing}`}>
                        Console
                    </a>
                    <Button variant="ghost" onClick={logout} disabled={signingOut} className="py-1.5">
                        {signingOut ? "Signing out…" : "Sign out"}
                    </Button>
                </div>
            </div>
        </header>
    )
}

function AdminApp({ self }: { self: DetailedUser }) {
    const [tab, setTab] = useState<Tab>(() => {
        const stored = sessionStorage.getItem(TAB_STORAGE_KEY)
        return stored === "roles" ? "roles" : "users"
    })
    const [users, setUsers] = useState<DetailedUser[] | null>(null)
    const [roles, setRoles] = useState<UndetailedRole[] | null>(null)
    const [loadError, setLoadError] = useState<string | null>(null)

    const refresh = useCallback(async () => {
        try {
            const [usersResponse, rolesResponse] = await Promise.all([
                apiGetUsers(api),
                apiGetRoles(api),
            ])
            setUsers(usersResponse.users)
            setRoles(rolesResponse.roles)
            setLoadError(null)
        } catch (e) {
            setLoadError(describeError(e))
        }
    }, [])

    useEffect(() => {
        refresh()
    }, [refresh])

    function switchTab(next: Tab) {
        setTab(next)
        sessionStorage.setItem(TAB_STORAGE_KEY, next)
    }

    const loaded = users != null && roles != null

    return (
        <div className="relative min-h-screen">
            <Glow />
            <TopBar self={self} />
            <main className="mx-auto max-w-6xl px-6 py-8">
                <nav aria-label="Admin sections"
                    className="mb-8 inline-flex rounded-xl border border-line bg-panel p-1">
                    {([
                        ["users", "Users", users?.length],
                        ["roles", "Roles", roles?.length],
                    ] as const).map(([key, label, count]) => (
                        <button key={key} type="button" onClick={() => switchTab(key)}
                            aria-current={tab === key ? "page" : undefined}
                            className={`rounded-lg px-5 py-2 text-sm font-medium transition ${focusRing}
                                ${tab === key
                                    ? "bg-panel-2 text-snow shadow-[inset_0_0_0_1px_rgba(122,162,255,0.35)]"
                                    : "text-fog hover:text-snow"}`}>
                            {label}
                            {count != null && (
                                <span className={`ml-2 font-mono text-xs ${tab === key ? "text-moon" : "text-fog/70"}`}>
                                    {count}
                                </span>
                            )}
                        </button>
                    ))}
                </nav>

                {loadError && (
                    <div className="mb-6 flex flex-col items-start gap-3">
                        <Banner tone="error">Couldn’t load the admin data: {loadError}</Banner>
                        <Button variant="ghost" onClick={refresh}>Retry</Button>
                    </div>
                )}

                {!loaded && !loadError && (
                    <p className="text-sm text-fog">Loading…</p>
                )}

                {loaded && tab === "users" && (
                    <UsersPanel api={api} self={self} users={users} roles={roles} onRefresh={refresh} />
                )}
                {loaded && tab === "roles" && (
                    <RolesPanel api={api} self={self} users={users} roles={roles} onRefresh={refresh} />
                )}
            </main>
        </div>
    )
}

function Main() {
    const [phase, setPhase] = useState<Phase>({ kind: "loading" })

    useEffect(() => {
        (async () => {
            if (!await ensureAuthenticated(api)) {
                setPhase({ kind: "signin" })
                return
            }
            const self = await apiGetUser(api)
            if (self.role !== "Admin") {
                setPhase({ kind: "forbidden", name: self.name })
                return
            }
            setPhase({ kind: "ready", self })
        })().catch(() => setPhase({ kind: "signin" }))
    }, [])

    switch (phase.kind) {
        case "loading":
            return (
                <div className="flex min-h-screen items-center justify-center text-fog">
                    <Glow />
                    Loading…
                </div>
            )
        case "signin":
            return <GateScreen title="Sign in first"
                body="The admin panel needs a signed-in session. Head to the console, sign in, and come back." />
        case "forbidden":
            return <GateScreen title="Admins only"
                body={`Sorry ${phase.name}, this panel is reserved for administrator accounts.`} />
        case "ready":
            return <AdminApp self={phase.self} />
    }
}

createRoot(document.getElementById("root")!).render(<StrictMode><Main /></StrictMode>)
