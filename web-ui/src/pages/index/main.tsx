import { useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import "../../styles.css"
import {
    Api,
    App,
    DetailedHost,
    DetailedRole,
    DetailedUser,
    FetchError,
    UndetailedHost,
    apiDeleteHost,
    apiGetHost,
    apiGetUser,
    apiHostCancel,
    apiLogout,
    apiPatchHost,
    apiWakeUp,
    bootstrapRole,
    createApi,
    ensureAuthenticated,
    listApps,
    login,
    streamHosts,
} from "../../lib/api"
import { getFavoriteIds, toggleFavorite } from "../../lib/favorites"
import { getRecentIds, recordRecent } from "../../lib/recents"
import { AddHostModal } from "../../components/AddHostModal"
import { AppTile } from "../../components/AppTile"
import { ConfirmModal, ConfirmRequest } from "../../components/ConfirmModal"
import { ContextMenu, MenuItem, MenuState } from "../../components/ContextMenu"
import { AddHostTile, HostTile, hostStatus } from "../../components/HostTile"
import { PairingModal } from "../../components/PairingModal"
import { ResumeHero } from "../../components/ResumeHero"
import { MoonSpinner } from "../../components/Spinner"
import { TileGrid } from "../../components/TileGrid"
import { Toasts, ToastAction, useToasts } from "../../components/Toasts"
import {
    IconArrowLeft,
    IconClock,
    IconGlobe,
    IconLock,
    IconPlay,
    IconRefresh,
    IconSignOut,
    IconStar,
    IconTrash,
    IconUser,
    IconZap,
    MoonMark,
} from "../../components/icons"

const api: Api = createApi()

type Phase = "boot" | "login" | "ready"
type View = { kind: "hosts" } | { kind: "apps"; hostId: number }

/** In-flight (or just-finished) Wake-on-LAN attempt, tracked for one host at a time. */
type WakeState = {
    hostId: number
    hostName: string
    startedAt: number
}

const WAKE_POLL_INTERVAL_MS = 3000
const WAKE_TIMEOUT_MS = 90_000

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => window.setTimeout(resolve, ms))
}

/** Staggered entrance delay for grid tiles, capped so late tiles don't lag. */
function riseDelay(index: number): React.CSSProperties {
    return { animationDelay: `${Math.min(index, 10) * 45}ms` }
}

function Wordmark({ size = 26 }: { size?: number }) {
    return (
        <span className="flex items-center gap-2.5">
            <MoonMark size={size} />
            <span className="text-lg font-semibold tracking-tight">
                Moonlight <span className="text-moon">Web</span>
            </span>
        </span>
    )
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

function LoginScreen({ onDone }: { onDone: () => void }) {
    const [name, setName] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    async function submit(event: React.FormEvent) {
        event.preventDefault()
        setBusy(true)
        setError(null)
        let ok = false
        try {
            ok = await login(api, name, password)
        } catch {
            setError("Couldn't reach the server. Check your connection and try again.")
            setBusy(false)
            return
        }
        setBusy(false)
        if (ok) {
            onDone()
        } else {
            setError("That name and password didn't match. Try again.")
        }
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-6">
            <div className="animate-rise flex flex-col items-center">
                <MoonMark size={64} />
                <h1 className="mt-5 text-3xl font-bold tracking-tight">
                    Moonlight <span className="text-moon">Web</span>
                </h1>
                <p className="mt-2 text-sm text-fog">Sign in to start streaming</p>
            </div>

            <form
                onSubmit={submit}
                style={{ animationDelay: "120ms" }}
                className="animate-rise mt-10 flex w-[22rem] max-w-full flex-col gap-4 rounded-tile
                    border border-line bg-panel p-7 shadow-[0_24px_80px_rgba(0,0,0,0.5)]"
            >
                <label className="flex flex-col gap-1.5 text-sm">
                    <span className="text-fog">Name</span>
                    <input
                        autoFocus
                        value={name}
                        onChange={event => setName(event.target.value)}
                        autoComplete="username"
                        spellCheck={false}
                        className="focus-ring rounded-lg border border-line bg-panel-2 px-3 py-2.5
                            text-snow placeholder:text-fog/50"
                    />
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                    <span className="text-fog">Password</span>
                    <input
                        type="password"
                        value={password}
                        onChange={event => setPassword(event.target.value)}
                        autoComplete="current-password"
                        className="focus-ring rounded-lg border border-line bg-panel-2 px-3 py-2.5
                            text-snow placeholder:text-fog/50"
                    />
                </label>

                {error && (
                    <p role="alert" className="rounded-lg border border-red-400/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                        {error}
                    </p>
                )}

                <button
                    disabled={busy}
                    className="focus-ring mt-1 flex items-center justify-center gap-2 rounded-lg bg-moon
                        py-2.5 text-sm font-semibold text-abyss transition hover:bg-moon/85
                        disabled:opacity-50"
                >
                    {busy && <MoonSpinner size={15} />}
                    {busy ? "Signing in…" : "Sign in"}
                </button>
            </form>
        </div>
    )
}

// ---------------------------------------------------------------------------
// App library (phase 3)
// ---------------------------------------------------------------------------

function AppsView({
    host,
    onBack,
    requestConfirm,
    toast,
}: {
    host: UndetailedHost
    onBack: () => void
    requestConfirm: (request: ConfirmRequest) => void
    toast: (message: string, kind?: "info" | "error") => void
}) {
    const [detail, setDetail] = useState<DetailedHost | null>(null)
    const [apps, setApps] = useState<App[] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [reloadKey, setReloadKey] = useState(0)
    // `host.host_id` never changes across an AppsView instance — the caller
    // remounts it (key={host.host_id}) when the viewed host changes — so
    // these initializers only re-run per host, which is what we want.
    const [favoriteIds, setFavoriteIds] = useState<number[]>(() => getFavoriteIds(host.host_id))
    const [recentIds, setRecentIds] = useState<number[]>(() => getRecentIds(host.host_id))

    useEffect(() => {
        let disposed = false
        setError(null)
        ;(async () => {
            try {
                const [freshDetail, freshApps] = await Promise.all([
                    apiGetHost(api, { host_id: host.host_id }),
                    listApps(api, host.host_id),
                ])
                if (!disposed) {
                    setDetail(freshDetail)
                    setApps(freshApps)
                }
            } catch {
                if (!disposed) {
                    setError("Couldn't load the app library. The host may have gone offline.")
                }
            }
        })()
        return () => {
            disposed = true
        }
    }, [host.host_id, reloadKey])

    const runningId = detail != null && detail.current_game !== 0 ? detail.current_game : null
    const runningApp = runningId != null ? apps?.find(app => app.app_id === runningId) : undefined

    const favoriteApps = apps?.filter(app => favoriteIds.includes(app.app_id)) ?? []
    const recentApps =
        apps == null
            ? []
            : recentIds
                  .map(id => apps.find(app => app.app_id === id))
                  .filter((app): app is App => app != null)

    function toggleFav(app: App) {
        setFavoriteIds(toggleFavorite(host.host_id, app.app_id))
    }

    function launch(app: App) {
        setRecentIds(recordRecent(host.host_id, app.app_id))
    }

    function quit(app: App) {
        requestConfirm({
            title: "Stop the current session?",
            body: `${app.title} is running on ${host.name}. Stopping it closes the app on the host — unsaved progress may be lost.`,
            confirmLabel: "Stop session",
            danger: true,
            action: async () => {
                try {
                    const response = await apiHostCancel(api, { host_id: host.host_id })
                    if (response.success) {
                        toast(`Stopped the session on ${host.name}`)
                    } else {
                        toast("The host refused to stop the app.", "error")
                    }
                } catch {
                    toast("Couldn't reach the host to stop the app.", "error")
                }
                setReloadKey(key => key + 1)
            },
        })
    }

    return (
        <section className="animate-rise">
            <div className="mb-7 flex flex-wrap items-center gap-4">
                <button
                    onClick={onBack}
                    aria-label="Back to machines"
                    className="focus-ring flex items-center gap-2 rounded-lg border border-line px-3 py-2
                        text-sm text-fog transition hover:border-fog hover:text-snow"
                >
                    <IconArrowLeft size={16} />
                    Machines
                </button>
                <h2 className="text-xl font-semibold tracking-tight">{host.name}</h2>
                {runningApp != null && (
                    <span
                        className="flex items-center gap-2 rounded-full border border-moon/40 px-3 py-1
                            text-xs font-medium text-moon"
                    >
                        <span aria-hidden className="size-1.5 rounded-full bg-moon animate-pulse-dot" />
                        Running: {runningApp.title}
                    </span>
                )}
                <button
                    onClick={() => setReloadKey(key => key + 1)}
                    aria-label="Refresh apps"
                    title="Refresh apps"
                    className="focus-ring ml-auto rounded-lg border border-line p-2 text-fog transition
                        hover:border-fog hover:text-snow"
                >
                    <IconRefresh size={16} />
                </button>
            </div>

            {error != null ? (
                <div className="flex flex-col items-start gap-4 rounded-tile border border-line bg-panel p-8">
                    <p className="text-sm text-fog">{error}</p>
                    <button
                        onClick={() => setReloadKey(key => key + 1)}
                        className="focus-ring rounded-lg bg-moon px-4 py-2 text-sm font-medium text-abyss
                            transition hover:bg-moon/85"
                    >
                        Try again
                    </button>
                </div>
            ) : apps == null ? (
                <div className="flex flex-wrap gap-5" aria-label="Loading apps">
                    {Array.from({ length: 5 }, (_, index) => (
                        <div
                            key={index}
                            style={riseDelay(index)}
                            className="animate-rise w-44 overflow-hidden rounded-tile border border-line bg-panel"
                        >
                            <div className="aspect-[3/4] animate-pulse bg-panel-2" />
                            <div className="m-3 h-4 animate-pulse rounded bg-panel-2" />
                        </div>
                    ))}
                </div>
            ) : apps.length === 0 ? (
                <p className="text-sm text-fog">
                    No apps are published on this host yet. Add some in Sunshine's web UI.
                </p>
            ) : (
                <>
                    {runningApp != null && (
                        <ResumeHero app={runningApp} hostId={host.host_id} onLaunch={launch} />
                    )}

                    {favoriteApps.length > 0 && (
                        <div className="mb-8">
                            <div
                                className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide
                                    text-fog uppercase"
                            >
                                <IconStar size={13} className="text-ember" fill="currentColor" />
                                Favorites
                            </div>
                            <TileGrid label={`Favorites on ${host.name}`}>
                                {favoriteApps.map((app, index) => (
                                    <div key={app.app_id} className="animate-rise" style={riseDelay(index)}>
                                        <AppTile
                                            app={app}
                                            hostId={host.host_id}
                                            running={app.app_id === runningId}
                                            anyRunning={runningId != null}
                                            favorite
                                            onQuit={quit}
                                            onToggleFavorite={toggleFav}
                                            onLaunch={launch}
                                        />
                                    </div>
                                ))}
                            </TileGrid>
                        </div>
                    )}

                    {favoriteApps.length === 0 && recentApps.length > 0 && (
                        <div className="mb-8">
                            <div
                                className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide
                                    text-fog uppercase"
                            >
                                <IconClock size={13} />
                                Recent
                            </div>
                            <TileGrid label={`Recently launched on ${host.name}`} className="gap-3">
                                {recentApps.map((app, index) => (
                                    <div key={app.app_id} className="animate-rise" style={riseDelay(index)}>
                                        <AppTile
                                            compact
                                            app={app}
                                            hostId={host.host_id}
                                            running={app.app_id === runningId}
                                            anyRunning={runningId != null}
                                            favorite={favoriteIds.includes(app.app_id)}
                                            onQuit={quit}
                                            onToggleFavorite={toggleFav}
                                            onLaunch={launch}
                                        />
                                    </div>
                                ))}
                            </TileGrid>
                        </div>
                    )}

                    <TileGrid label={`Apps on ${host.name}`}>
                        {apps.map((app, index) => (
                            <div key={app.app_id} className="animate-rise" style={riseDelay(index)}>
                                <AppTile
                                    app={app}
                                    hostId={host.host_id}
                                    running={app.app_id === runningId}
                                    anyRunning={runningId != null}
                                    favorite={favoriteIds.includes(app.app_id)}
                                    onQuit={quit}
                                    onToggleFavorite={toggleFav}
                                    onLaunch={launch}
                                />
                            </div>
                        ))}
                    </TileGrid>
                </>
            )}
        </section>
    )
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

function Main() {
    const [phase, setPhase] = useState<Phase>("boot")
    const [bootError, setBootError] = useState<string | null>(null)
    const [user, setUser] = useState<DetailedUser | null>(null)
    const [role, setRole] = useState<DetailedRole | null>(null)
    const [hosts, setHosts] = useState<UndetailedHost[]>([])
    const [refreshing, setRefreshing] = useState(false)
    const [view, setView] = useState<View>({ kind: "hosts" })

    const [menu, setMenu] = useState<MenuState | null>(null)
    const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
    const [addingHost, setAddingHost] = useState(false)
    const [pairingHost, setPairingHost] = useState<UndetailedHost | null>(null)
    const [waking, setWaking] = useState<WakeState | null>(null)

    const { toasts, push: toast, remove: dismissToast } = useToasts()
    const refreshingRef = useRef(false)
    // Bumped on every start/cancel so a stale poll loop can tell it's no
    // longer the current attempt and stop touching state.
    const wakeTokenRef = useRef(0)

    async function refreshHosts() {
        if (refreshingRef.current) {
            return
        }
        refreshingRef.current = true
        setRefreshing(true)
        try {
            await streamHosts(api, setHosts)
        } catch {
            toast("Couldn't refresh the machine list.", "error")
        } finally {
            refreshingRef.current = false
            setRefreshing(false)
        }
    }

    async function bootstrap() {
        setBootError(null)
        try {
            const [freshUser, freshRole] = await Promise.all([apiGetUser(api), bootstrapRole(api)])
            setUser(freshUser)
            setRole(freshRole)
            setPhase("ready")
            void refreshHosts()
        } catch {
            setBootError("Couldn't load your account from the server.")
        }
    }

    useEffect(() => {
        ;(async () => {
            try {
                if (await ensureAuthenticated(api)) {
                    await bootstrap()
                } else {
                    setPhase("login")
                }
            } catch {
                setBootError("Couldn't reach the server.")
            }
        })()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const isAdmin = user?.role === "Admin"
    const canAddHosts = role?.permissions.allow_add_hosts ?? false

    function mergeHost(updated: UndetailedHost | DetailedHost) {
        setHosts(current => {
            const index = current.findIndex(host => host.host_id === updated.host_id)
            if (index === -1) {
                return [...current, updated]
            }
            const next = [...current]
            next[index] = { ...next[index], ...updated }
            return next
        })
    }

    function openApps(host: UndetailedHost) {
        setView({ kind: "apps", hostId: host.host_id })
    }

    function openHost(host: UndetailedHost, x: number, y: number) {
        const status = hostStatus(host)
        if (status === "ready") {
            openApps(host)
            return
        }
        if (status === "unpaired") {
            setPairingHost(host)
            return
        }
        // Offline. A paired host is the wake-and-play case: promote straight
        // to sending the WoL packet instead of making the user open a menu
        // first. Clicking the tile again while it's waking cancels.
        if (host.paired === "Paired") {
            if (waking?.hostId === host.host_id) {
                cancelWake()
            } else if (waking != null) {
                toast(`Already waking ${waking.hostName} — cancel that first.`, "info")
            } else {
                void startWake(host)
            }
            return
        }
        // Offline and never paired: nothing to wake into yet, surface actions.
        setMenu({ x, y, items: hostMenuItems(host) })
    }

    async function refreshHost(host: UndetailedHost) {
        try {
            mergeHost(await apiGetHost(api, { host_id: host.host_id }))
        } catch {
            toast(`Couldn't refresh ${host.name}.`, "error")
        }
    }

    function cancelWake() {
        wakeTokenRef.current++
        setWaking(null)
    }

    async function startWake(host: UndetailedHost) {
        if (waking != null) {
            if (waking.hostId !== host.host_id) {
                toast(`Already waking ${waking.hostName} — cancel that first.`, "info")
            }
            return
        }
        const token = ++wakeTokenRef.current
        setWaking({ hostId: host.host_id, hostName: host.name, startedAt: Date.now() })

        try {
            await apiWakeUp(api, { host_id: host.host_id })
        } catch (e) {
            if (wakeTokenRef.current === token) {
                setWaking(null)
            }
            if (e instanceof FetchError && e.getResponse()?.status === 404) {
                toast(
                    `${host.name} has no known MAC address — it must have been online at least once ` +
                        "before it can be woken remotely.",
                    "error",
                )
            } else {
                toast(`Couldn't send a wake-up packet to ${host.name}.`, "error")
            }
            return
        }

        if (wakeTokenRef.current !== token) {
            // Cancelled while the request was in flight.
            return
        }
        void pollForWake(host, token)
    }

    /** Polls apiGetHost every WAKE_POLL_INTERVAL_MS until online, cancelled, or WAKE_TIMEOUT_MS elapses. */
    async function pollForWake(host: UndetailedHost, token: number) {
        const deadline = Date.now() + WAKE_TIMEOUT_MS

        while (wakeTokenRef.current === token && Date.now() < deadline) {
            await sleep(WAKE_POLL_INTERVAL_MS)
            if (wakeTokenRef.current !== token) {
                return
            }
            try {
                const fresh = await apiGetHost(api, { host_id: host.host_id })
                mergeHost(fresh)
                if (fresh.server_state != null) {
                    if (wakeTokenRef.current === token) {
                        setWaking(null)
                        toast(`${host.name} is awake — opening its library.`)
                        openApps(host)
                    }
                    return
                }
            } catch {
                // Transient — the host may just not be reachable yet. Keep polling.
            }
        }

        if (wakeTokenRef.current === token) {
            setWaking(null)
            const retry: ToastAction = { label: "Retry", onClick: () => void startWake(host) }
            toast(`${host.name} didn't come online within 90 seconds.`, "warning", retry)
        }
    }

    async function setHostOwner(host: UndetailedHost, owner: number | null) {
        try {
            await apiPatchHost(api, { host_id: host.host_id, change_owner: true, owner })
            mergeHost({ ...host, owner: owner == null ? "Global" : "ThisUser" })
            toast(owner == null ? `${host.name} is now shared with everyone.` : `${host.name} is now private.`)
        } catch {
            toast(`Couldn't change who can see ${host.name}.`, "error")
        }
    }

    function removeHost(host: UndetailedHost) {
        setConfirm({
            title: `Remove ${host.name}?`,
            body:
                "The machine disappears from this server for every user it's visible to. " +
                "Nothing changes on the host itself, and you can add it back later.",
            confirmLabel: "Remove host",
            danger: true,
            action: async () => {
                try {
                    await apiDeleteHost(api, { host_id: host.host_id })
                    setHosts(current => current.filter(other => other.host_id !== host.host_id))
                    setView(current =>
                        current.kind === "apps" && current.hostId === host.host_id ? { kind: "hosts" } : current,
                    )
                    toast(`Removed ${host.name}.`)
                } catch {
                    toast(`Couldn't remove ${host.name}.`, "error")
                }
            },
        })
    }

    function hostMenuItems(host: UndetailedHost): MenuItem[] {
        const status = hostStatus(host)
        const items: MenuItem[] = []
        if (status === "ready") {
            items.push({ label: "Open library", icon: <IconPlay size={16} />, onSelect: () => openApps(host) })
        }
        if (status === "unpaired") {
            items.push({ label: "Pair…", icon: <IconLock size={16} />, onSelect: () => setPairingHost(host) })
        }
        if (status === "offline" && host.paired === "Paired") {
            const isWakingThis = waking?.hostId === host.host_id
            items.push({
                label: isWakingThis ? "Cancel waking" : "Wake up",
                icon: <IconZap size={16} />,
                onSelect: () => (isWakingThis ? cancelWake() : void startWake(host)),
            })
        }
        items.push({ label: "Refresh", icon: <IconRefresh size={16} />, onSelect: () => void refreshHost(host) })
        if (isAdmin) {
            if (host.owner === "Global") {
                items.push({
                    label: "Make private",
                    icon: <IconUser size={16} />,
                    danger: true,
                    onSelect: () => void setHostOwner(host, user?.id ?? null),
                })
            } else {
                items.push({
                    label: "Share with everyone",
                    icon: <IconGlobe size={16} />,
                    danger: true,
                    onSelect: () => void setHostOwner(host, null),
                })
            }
        }
        if (host.owner === "ThisUser" || isAdmin) {
            items.push({
                label: "Remove host…",
                icon: <IconTrash size={16} />,
                danger: true,
                onSelect: () => removeHost(host),
            })
        }
        return items
    }

    // ---- Screens ----------------------------------------------------------

    if (phase === "boot") {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-6">
                {bootError == null ? (
                    <>
                        <MoonMark size={56} />
                        <div className="flex items-center gap-2.5 text-fog">
                            <MoonSpinner size={18} className="text-moon" />
                            <span className="text-sm">Connecting…</span>
                        </div>
                    </>
                ) : (
                    <>
                        <MoonMark size={56} glow={false} />
                        <p className="text-sm text-fog">{bootError}</p>
                        <button
                            onClick={() => void bootstrap()}
                            className="focus-ring rounded-lg bg-moon px-5 py-2 text-sm font-medium text-abyss
                                transition hover:bg-moon/85"
                        >
                            Try again
                        </button>
                    </>
                )}
            </div>
        )
    }

    if (phase === "login") {
        return (
            <>
                <LoginScreen onDone={() => void bootstrap()} />
                <Toasts toasts={toasts} onDismiss={dismissToast} />
            </>
        )
    }

    const viewedHost =
        view.kind === "apps" ? hosts.find(host => host.host_id === view.hostId) ?? null : null

    return (
        <div className="mx-auto min-h-screen w-full max-w-[1400px] px-8 pb-20 md:px-12">
            <header className="flex items-center gap-4 py-7">
                <Wordmark />
                <div className="ml-auto flex items-center gap-3">
                    {user != null && (
                        <span className="flex items-center gap-2 text-sm text-fog">
                            <IconUser size={15} />
                            {user.name}
                            {isAdmin && (
                                <span
                                    className="rounded-full border border-moon/40 px-2 py-0.5 text-[0.65rem]
                                        font-medium tracking-wide text-moon uppercase"
                                >
                                    Admin
                                </span>
                            )}
                        </span>
                    )}
                    {user != null && !user.is_default_user && (
                        <button
                            onClick={() => void apiLogout(api).then(() => window.location.reload())}
                            aria-label="Sign out"
                            title="Sign out"
                            className="focus-ring rounded-lg border border-line p-2 text-fog transition
                                hover:border-fog hover:text-snow"
                        >
                            <IconSignOut size={16} />
                        </button>
                    )}
                </div>
            </header>

            <main>
                {viewedHost != null ? (
                    <AppsView
                        key={viewedHost.host_id}
                        host={viewedHost}
                        onBack={() => setView({ kind: "hosts" })}
                        requestConfirm={setConfirm}
                        toast={toast}
                    />
                ) : (
                    <section className="animate-rise">
                        <div className="mb-7 flex items-center gap-3">
                            <h2 className="text-xl font-semibold tracking-tight">Machines</h2>
                            <span className="text-sm text-fog tabular">{hosts.length}</span>
                            <button
                                onClick={() => void refreshHosts()}
                                aria-label="Refresh machines"
                                title="Refresh machines"
                                className="focus-ring ml-auto flex items-center gap-2 rounded-lg border
                                    border-line px-3 py-2 text-sm text-fog transition hover:border-fog
                                    hover:text-snow"
                            >
                                {refreshing ? <MoonSpinner size={15} /> : <IconRefresh size={15} />}
                                Refresh
                            </button>
                        </div>

                        {hosts.length === 0 && !refreshing && (
                            <p className="mb-6 text-sm text-fog">
                                No machines yet. {canAddHosts ? "Add the computer running Sunshine to get started." : "Ask an admin to add one for you."}
                            </p>
                        )}

                        <TileGrid label="Machines">
                            {hosts.map((host, index) => (
                                <div key={host.host_id} className="animate-rise" style={riseDelay(index)}>
                                    <HostTile
                                        host={host}
                                        onOpen={(target, x, y) => openHost(target, x, y)}
                                        onMenu={(target, x, y) =>
                                            setMenu({ x, y, items: hostMenuItems(target) })
                                        }
                                        wakingSince={waking?.hostId === host.host_id ? waking.startedAt : null}
                                    />
                                </div>
                            ))}
                            {canAddHosts && (
                                <div className="animate-rise" style={riseDelay(hosts.length)}>
                                    <AddHostTile onClick={() => setAddingHost(true)} />
                                </div>
                            )}
                        </TileGrid>
                    </section>
                )}
            </main>

            {menu != null && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
            {confirm != null && <ConfirmModal request={confirm} onClose={() => setConfirm(null)} />}
            {addingHost && (
                <AddHostModal
                    api={api}
                    onClose={() => setAddingHost(false)}
                    onAdded={host => {
                        mergeHost(host)
                        setAddingHost(false)
                        toast(`Added ${host.name}.`)
                        if (host.server_state != null && host.paired !== "Paired") {
                            setPairingHost(host)
                        }
                    }}
                />
            )}
            {pairingHost != null && (
                <PairingModal
                    api={api}
                    host={pairingHost}
                    onClose={() => setPairingHost(null)}
                    onPaired={paired => {
                        mergeHost(paired)
                        setPairingHost(null)
                        openApps(paired)
                    }}
                />
            )}
            <Toasts toasts={toasts} onDismiss={dismissToast} />
        </div>
    )
}

createRoot(document.getElementById("root")!).render(
    // No StrictMode: the pairing flow drives a one-shot streamed request from
    // an effect; a dev double-mount would start a second pairing attempt that
    // the server rejects with PairingInProgress. (Matches the stream page.)
    <Main />,
)
