import { useCallback, useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import "../../styles.css"
import { Api, createApi, ensureAuthenticated, bootstrapRole } from "../../lib/api"
import { Stream, InfoEvent } from "@engine/stream/index"
import { requestKeyboardLock } from "@engine/iframe"
import type { Settings } from "@engine/component/settings_menu"
import type { StreamPermissions } from "@engine/api_bindings"
import type { StreamStatsData } from "@engine/stream/stats"
import { OverlayMenu } from "./OverlayMenu"
import { StatsHud } from "./StatsHud"
import { ConnectingOverlay, EndScreen } from "./screens"
import {
    QUALITY_QUERY_KEYS,
    QualityDraft,
    alignedViewportSize,
    applyQualityToSettings,
    loadStreamSettings,
    persistStreamSettings,
    qualityFromSettings,
    resolveEngineSettings,
    sanitizeSettings,
} from "./settings"

const api: Api = createApi()

const params = new URLSearchParams(window.location.search)
const hostId = parseInt(params.get("host_id") ?? "")
const appId = parseInt(params.get("app_id") ?? "")
const paramsInvalid = Number.isNaN(hostId) || Number.isNaN(appId)

const EDGE_OPEN_DELAY_MS = 400
const EDGE_HOT_PX = 8
const HINT_TOAST_MS = 5000
const MAX_LOG_LINES = 300

type Phase =
    | { kind: "connecting"; status: string }
    | { kind: "live" }
    | { kind: "ended"; reason: "ended" | "error"; message: string }

function classifyFatalLine(line: string): { reason: "ended" | "error"; message: string } {
    // "ConnectionTerminated with code 0" is a graceful host-side stop; any
    // other code (or other fatal line) is an error worth surfacing verbatim.
    const terminated = line.match(/^ConnectionTerminated with code (-?\d+)/)
    if (terminated) {
        const code = Number(terminated[1])
        if (code === 0) {
            return { reason: "ended", message: "The host ended the stream." }
        }
        return { reason: "error", message: `The host terminated the connection (code ${code}).` }
    }
    return { reason: "error", message: line }
}

function StreamPage() {
    const containerRef = useRef<HTMLDivElement>(null)
    const streamRef = useRef<Stream | null>(null)
    const settingsRef = useRef<Settings | null>(null)
    const logsRef = useRef<string[]>([])

    const [phase, setPhase] = useState<Phase>(
        paramsInvalid
            ? { kind: "ended", reason: "error", message: "Missing host_id or app_id in the URL." }
            : { kind: "connecting", status: "Connecting…" },
    )
    const [appTitle, setAppTitle] = useState<string | null>(null)
    const [permissions, setPermissions] = useState<StreamPermissions | null>(null)
    const [activeQuality, setActiveQuality] = useState<QualityDraft | null>(null)
    const [menuOpen, setMenuOpen] = useState(false)
    const [statsVisible, setStatsVisible] = useState(false)
    const [pointerLocked, setPointerLocked] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [linkQuality, setLinkQuality] = useState<"Ok" | "Poor" | null>(null)
    const [transportName, setTransportName] = useState<string | null>(null)
    const [showHint, setShowHint] = useState(false)
    const [edgeHot, setEdgeHot] = useState(false)
    const [, setLogVersion] = useState(0)

    // Refs mirroring state that raw DOM handlers need synchronously
    const phaseRef = useRef(phase)
    phaseRef.current = phase
    const menuOpenRef = useRef(menuOpen)
    menuOpenRef.current = menuOpen

    const toggleMenu = useCallback(() => setMenuOpen(open => !open), [])
    const closeMenu = useCallback(() => setMenuOpen(false), [])

    // Menu open/close side effects: release held keys and the pointer lock on
    // open (the menu needs a visible cursor); refocus the video on close so
    // game input resumes cleanly.
    useEffect(() => {
        if (menuOpen) {
            streamRef.current?.getInput()?.raiseAllKeys()
            if (document.pointerLockElement) {
                document.exitPointerLock()
            }
        } else {
            (document.activeElement as HTMLElement | null)?.blur?.()
            containerRef.current?.focus()
        }
    }, [menuOpen])

    useEffect(() => {
        const onFullscreenChange = () => setIsFullscreen(document.fullscreenElement != null)
        document.addEventListener("fullscreenchange", onFullscreenChange)
        return () => document.removeEventListener("fullscreenchange", onFullscreenChange)
    }, [])

    useEffect(() => {
        if (!containerRef.current || paramsInvalid) {
            return
        }
        const container = containerRef.current
        let cancelled = false
        let stream: Stream | null = null
        let hintTimer: number | null = null

        const pushLog = (line: string) => {
            logsRef.current.push(line)
            if (logsRef.current.length > MAX_LOG_LINES) {
                logsRef.current.splice(0, logsRef.current.length - MAX_LOG_LINES)
            }
            // Lines that arrive after the end screen is up should still show in it
            if (phaseRef.current.kind === "ended") {
                setLogVersion(v => v + 1)
            }
        }
        const endStream = (reason: "ended" | "error", message: string) => {
            setPhase(prev => prev.kind === "ended" ? prev : { kind: "ended", reason, message })
        }

        ;(async () => {
            if (!(await ensureAuthenticated(api))) {
                window.location.href = "/"
                return
            }
            const role = await bootstrapRole(api)
            if (cancelled) {
                return
            }

            const settings = sanitizeSettings(loadStreamSettings(role.default_settings, params), role.permissions)
            settingsRef.current = settings
            setPermissions(role.permissions)
            setActiveQuality(qualityFromSettings(settings))

            const engineSettings = resolveEngineSettings(settings)
            const viewport = alignedViewportSize()

            stream = new Stream(api, hostId, appId, engineSettings, [viewport.width, viewport.height], role.permissions)
            streamRef.current = stream

            stream.addInfoListener((event: InfoEvent) => {
                const info = event.detail
                if (info.type === "connectionStatus") {
                    setLinkQuality(info.status)
                } else if (info.type === "videoReady") {
                    setPhase(prev => prev.kind === "ended" ? prev : { kind: "live" })
                    setShowHint(true)
                    hintTimer = window.setTimeout(() => setShowHint(false), HINT_TOAST_MS)
                } else if (info.type === "app") {
                    setAppTitle(info.app.title)
                } else if (info.type === "serverMessage") {
                    setPhase(prev => prev.kind === "connecting" ? { kind: "connecting", status: info.message } : prev)
                } else if (info.type === "connectionComplete") {
                    setPhase(prev => prev.kind === "connecting" ? { kind: "connecting", status: "Preparing video & audio…" } : prev)
                } else if (info.type === "addDebugLine") {
                    console.log("[stream]", info.line)
                    pushLog(info.line)

                    if (info.line === "Trying WebRTC transport") {
                        setTransportName("WebRTC")
                    } else if (info.line === "Trying Web Socket transport") {
                        setTransportName("WebSocket")
                    }

                    // Fatal engine errors must reach the user, not just the console
                    if (info.additional?.type === "fatal" || info.additional?.type === "fatalDescription") {
                        const { reason, message } = classifyFatalLine(info.line)
                        endStream(reason, message)
                    } else if (info.line === "Web Socket Closed" && phaseRef.current.kind === "live") {
                        // The control socket dropping mid-stream means the host is gone.
                        // (During connection setup it also closes on transport fallback,
                        // so only treat it as the end once we were live.)
                        endStream("ended", "The connection to the host was closed.")
                    }
                }
            })

            stream.mount(container)
            container.focus()
            await stream.startConnection()
        })()

        // -- Input forwarding (keyboard + mouse; gated off while UI chrome is up)
        const input = () => streamRef.current?.getInput()
        const rect = () => container.getBoundingClientRect()
        const canForward = () => !menuOpenRef.current && phaseRef.current.kind !== "ended"

        const onKeyDown = (e: KeyboardEvent) => {
            // Menu hotkey always wins and never reaches the game
            if (e.ctrlKey && e.shiftKey && e.code === "KeyM") {
                e.preventDefault()
                toggleMenu()
                return
            }
            if (menuOpenRef.current) {
                if (e.code === "Escape") {
                    e.preventDefault()
                    closeMenu()
                }
                return
            }
            if (phaseRef.current.kind === "ended") {
                return
            }
            // Suppress browser shortcuts while the game has the keyboard
            // (Ctrl+W, Ctrl+T, "/" quick-find...). Exceptions match the old
            // UI: Ctrl+Shift+V pasting and F11 manual fullscreen stay native.
            if (!(e.shiftKey && e.ctrlKey && e.code === "KeyV") && e.code !== "F11") {
                e.preventDefault()
            }
            input()?.onKeyDown(e)
        }
        // Key releases are always forwarded so no key stays held on the host
        const onKeyUp = (e: KeyboardEvent) => input()?.onKeyUp(e)
        const onMouseDown = (e: MouseEvent) => {
            if (menuOpenRef.current) {
                // Clicking the video area dismisses the menu without leaking a click
                closeMenu()
                return
            }
            if (phaseRef.current.kind === "ended") {
                return
            }
            container.focus()
            streamRef.current?.getVideoRenderer()?.onUserInteraction()
            streamRef.current?.getAudioPlayer()?.onUserInteraction()
            input()?.onMouseDown(e, rect())
        }
        const onMouseUp = (e: MouseEvent) => { if (canForward()) input()?.onMouseUp(e) }

        // Edge-hover menu opening is detected on the video's own mousemove so
        // no chrome element ever sits above the game and steals its input.
        let edgeTimer: number | null = null
        const clearEdge = () => {
            if (edgeTimer != null) {
                window.clearTimeout(edgeTimer)
                edgeTimer = null
                setEdgeHot(false)
            }
        }
        const detectEdgeHover = (e: MouseEvent) => {
            if (menuOpenRef.current || phaseRef.current.kind === "ended" || document.pointerLockElement) {
                clearEdge()
                return
            }
            if (e.clientX >= window.innerWidth - EDGE_HOT_PX) {
                if (edgeTimer == null) {
                    setEdgeHot(true)
                    edgeTimer = window.setTimeout(() => {
                        edgeTimer = null
                        setEdgeHot(false)
                        setMenuOpen(true)
                    }, EDGE_OPEN_DELAY_MS)
                }
            } else {
                clearEdge()
            }
        }
        const onMouseMove = (e: MouseEvent) => {
            if (canForward()) {
                input()?.onMouseMove(e, rect())
            }
            detectEdgeHover(e)
        }
        const onWheel = (e: WheelEvent) => { if (canForward()) input()?.onMouseWheel(e) }
        const onContextMenu = (e: Event) => e.preventDefault()

        document.addEventListener("keydown", onKeyDown)
        document.addEventListener("keyup", onKeyUp)
        container.addEventListener("mousedown", onMouseDown)
        container.addEventListener("mouseup", onMouseUp)
        container.addEventListener("mousemove", onMouseMove)
        container.addEventListener("wheel", onWheel, { passive: false })
        container.addEventListener("contextmenu", onContextMenu)

        // Mouse-lock state: while the pointer is locked, feed the engine
        // relative deltas (game-style aim); otherwise absolute positions.
        const onPointerLockChange = () => {
            const locked = document.pointerLockElement === container
            setPointerLocked(locked)
            const streamInput = input()
            if (streamInput) {
                streamInput.setConfig({ ...streamInput.getConfig(), mouseMode: locked ? "relative" : "follow" })
            }
        }
        document.addEventListener("pointerlockchange", onPointerLockChange)

        // Don't leave keys held on the host when the tab loses focus
        const onBlur = () => input()?.raiseAllKeys()
        window.addEventListener("blur", onBlur)

        return () => {
            cancelled = true
            if (hintTimer != null) {
                window.clearTimeout(hintTimer)
            }
            clearEdge()
            document.removeEventListener("keydown", onKeyDown)
            document.removeEventListener("keyup", onKeyUp)
            container.removeEventListener("mousedown", onMouseDown)
            container.removeEventListener("mouseup", onMouseUp)
            container.removeEventListener("mousemove", onMouseMove)
            container.removeEventListener("wheel", onWheel)
            container.removeEventListener("contextmenu", onContextMenu)
            document.removeEventListener("pointerlockchange", onPointerLockChange)
            window.removeEventListener("blur", onBlur)
            if (stream) {
                stream.stop().catch(() => {})
                stream.unmount(container)
                streamRef.current = null
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    async function toggleFullscreen() {
        if (document.fullscreenElement) {
            await document.exitFullscreen().catch(() => {})
            return
        }
        try {
            await document.body.requestFullscreen({ navigationUI: "hide" })
            // Capture Esc/Meta so games receive them (hold Esc exits fullscreen)
            await requestKeyboardLock().catch(() => {})
        } catch (e) {
            console.warn("fullscreen failed", e)
        }
    }

    function lockMouse() {
        closeMenu()
        containerRef.current?.requestPointerLock()
    }

    function toggleStats() {
        const next = !statsVisible
        streamRef.current?.getStats()?.setEnabled(next)
        setStatsVisible(next)
    }

    const getStatsData = useCallback((): StreamStatsData | null => {
        return streamRef.current?.getStats()?.getCurrentStats() ?? null
    }, [])

    async function applyQuality(draft: QualityDraft) {
        const base = settingsRef.current
        if (!base) {
            return
        }
        persistStreamSettings(applyQualityToSettings(base, draft))
        closeMenu()
        try {
            await streamRef.current?.stop()
        } catch { /* best effort */ }
        // Reload with the same host/app params; quality overrides in the URL
        // are dropped so the freshly persisted settings take effect.
        const url = new URL(window.location.href)
        for (const key of QUALITY_QUERY_KEYS) {
            url.searchParams.delete(key)
        }
        window.location.replace(url.toString())
    }

    async function disconnect() {
        try {
            await streamRef.current?.stop()
        } catch { /* best effort */ }
        window.location.href = "/"
    }

    const live = phase.kind === "live"

    return (
        <div className="fixed inset-0 bg-abyss">
            <div ref={containerRef} tabIndex={0}
                className={`absolute inset-0 outline-none
                    [&_video]:w-full [&_video]:h-full [&_canvas]:w-full [&_canvas]:h-full
                    ${live && !menuOpen ? "cursor-none" : ""}`} />

            {phase.kind === "connecting" && (
                <ConnectingOverlay appTitle={appTitle} status={phase.status} />
            )}

            {phase.kind === "ended" && (
                <EndScreen kind={phase.reason} message={phase.message}
                    logs={logsRef.current} onRetry={() => window.location.reload()} />
            )}

            {/* Poor-connection warning (engine link-quality signal) */}
            {live && linkQuality === "Poor" && (
                <div className="pointer-events-none absolute top-4 left-4 z-30 flex items-center gap-2
                    rounded-full border border-amber-400/40 bg-abyss/80 px-3 py-1.5 backdrop-blur-md">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                    <span className="text-xs text-amber-300">Poor connection</span>
                </div>
            )}

            <StatsHud visible={live && statsVisible} getStats={getStatsData}
                meta={{ transportName, targetBitrateKbps: activeQuality?.bitrateKbps ?? 0 }} />

            {/* Transient hint once the stream is up */}
            {live && showHint && !menuOpen && (
                <div className="pointer-events-none absolute bottom-6 left-1/2 z-30 -translate-x-1/2
                    rounded-full border border-line bg-panel/90 px-4 py-1.5 text-xs text-fog backdrop-blur-md">
                    Menu — hover the right edge or press <span className="text-snow">Ctrl+Shift+M</span>
                </div>
            )}

            {/* Edge-hover affordance (detection happens on the video's mousemove,
                so nothing here can intercept game input) */}
            {edgeHot && !menuOpen && (
                <div className="pointer-events-none absolute inset-y-0 right-0 z-30 w-0.5
                    bg-gradient-to-b from-transparent via-moon/70 to-transparent
                    shadow-[0_0_12px_rgba(122,162,255,0.5)]" />
            )}

            <OverlayMenu open={menuOpen} onClose={closeMenu}
                appTitle={appTitle}
                isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen}
                pointerLocked={pointerLocked} onLockMouse={lockMouse}
                statsVisible={statsVisible} onToggleStats={toggleStats}
                activeQuality={activeQuality ?? {
                    bitrateKbps: 10000, resolution: "native", fps: 60, codec: "auto", transport: "auto",
                }}
                permissions={permissions}
                onApply={applyQuality} onDisconnect={disconnect} />
        </div>
    )
}

createRoot(document.getElementById("root")!).render(
    // No StrictMode here: the engine Stream is not double-mount safe
    <StreamPage />,
)
