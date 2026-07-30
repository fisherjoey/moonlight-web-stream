import { StrictMode, useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import "../../styles.css"
import {
    Api, App, UndetailedHost,
    createApi, ensureAuthenticated, listApps, listHosts, login,
} from "../../lib/api"

const api: Api = createApi()

type Phase = "loading" | "login" | "hosts"

function LoginCard({ onDone }: { onDone: () => void }) {
    const [name, setName] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    async function submit(event: React.FormEvent) {
        event.preventDefault()
        setBusy(true)
        setError(null)
        const ok = await login(api, name, password)
        setBusy(false)
        if (ok) {
            onDone()
        } else {
            setError("Wrong name or password")
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center">
            <form onSubmit={submit}
                className="w-80 rounded-2xl bg-panel border border-line p-8 flex flex-col gap-4 shadow-2xl">
                <h1 className="text-xl font-semibold tracking-tight">
                    <span className="text-moon">Moonlight</span> Web
                </h1>
                <input autoFocus value={name} onChange={e => setName(e.target.value)}
                    placeholder="Name" autoComplete="username"
                    className="rounded-lg bg-panel-2 border border-line px-3 py-2 outline-none focus:border-moon" />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Password" autoComplete="current-password"
                    className="rounded-lg bg-panel-2 border border-line px-3 py-2 outline-none focus:border-moon" />
                {error && <p className="text-sm text-red-400">{error}</p>}
                <button disabled={busy}
                    className="rounded-lg bg-moon/90 hover:bg-moon text-abyss font-medium py-2 transition disabled:opacity-50">
                    {busy ? "Signing in…" : "Sign in"}
                </button>
            </form>
        </div>
    )
}

function HostTile({ host, onOpen }: { host: UndetailedHost, onOpen: (host: UndetailedHost) => void }) {
    const online = host.server_state != null
    const paired = host.paired === "Paired"
    return (
        <button onClick={() => onOpen(host)}
            className="group w-56 rounded-2xl bg-panel border border-line p-6 text-left transition
                hover:border-moon focus-visible:border-moon outline-none
                hover:shadow-[0_0_24px_rgba(122,162,255,0.25)]">
            <div className="text-4xl mb-4">🖥️</div>
            <div className="font-medium truncate">{host.name}</div>
            <div className="text-sm text-fog">
                {online ? (paired ? "Ready" : "Not paired") : "Offline"}
            </div>
        </button>
    )
}

function AppTile({ app, hostId }: { app: App, hostId: number }) {
    const art = `/api/app/image?host_id=${hostId}&app_id=${app.app_id}`
    return (
        <a href={`stream.html?host_id=${hostId}&app_id=${app.app_id}`}
            className="group w-44 rounded-2xl overflow-hidden bg-panel border border-line transition
                hover:border-moon focus-visible:border-moon outline-none
                hover:shadow-[0_0_24px_rgba(122,162,255,0.25)]">
            <img src={art} alt="" className="w-full aspect-[3/4] object-cover bg-panel-2"
                onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
            <div className="p-3 text-sm font-medium truncate">{app.title}</div>
        </a>
    )
}

function Main() {
    const [phase, setPhase] = useState<Phase>("loading")
    const [hosts, setHosts] = useState<UndetailedHost[]>([])
    const [openHost, setOpenHost] = useState<UndetailedHost | null>(null)
    const [apps, setApps] = useState<App[]>([])

    async function loadHosts() {
        setPhase("hosts")
        setHosts(await listHosts(api))
    }

    useEffect(() => {
        ensureAuthenticated(api).then(ok => ok ? loadHosts() : setPhase("login"))
    }, [])

    async function onOpenHost(host: UndetailedHost) {
        setOpenHost(host)
        setApps(await listApps(api, host.host_id))
    }

    if (phase === "loading") {
        return <div className="min-h-screen flex items-center justify-center text-fog">Loading…</div>
    }
    if (phase === "login") {
        return <LoginCard onDone={loadHosts} />
    }
    return (
        <div className="min-h-screen px-10 py-8">
            <h1 className="text-lg font-semibold mb-6 tracking-tight">
                <span className="text-moon">Moonlight</span> Web
            </h1>
            {!openHost && (
                <div className="flex flex-wrap gap-5">
                    {hosts.map(host => <HostTile key={host.host_id} host={host} onOpen={onOpenHost} />)}
                    {hosts.length === 0 && <p className="text-fog">No hosts yet.</p>}
                </div>
            )}
            {openHost && (
                <div>
                    <button onClick={() => setOpenHost(null)} className="text-fog hover:text-snow mb-5 transition">
                        ← {openHost.name}
                    </button>
                    <div className="flex flex-wrap gap-5">
                        {apps.map(app => <AppTile key={app.app_id} app={app} hostId={openHost.host_id} />)}
                        {apps.length === 0 && <p className="text-fog">Loading apps…</p>}
                    </div>
                </div>
            )}
        </div>
    )
}

createRoot(document.getElementById("root")!).render(<StrictMode><Main /></StrictMode>)
