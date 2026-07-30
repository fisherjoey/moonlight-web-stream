import { useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import "../../styles.css"
import { Api, createApi, ensureAuthenticated, bootstrapRole } from "../../lib/api"
import { Stream, InfoEvent } from "@engine/stream/index"
import { globalDefaultSettings } from "@engine/component/settings_menu"
import { requestKeyboardLock } from "@engine/iframe"

const api: Api = createApi()

const params = new URLSearchParams(window.location.search)
const hostId = parseInt(params.get("host_id") ?? "")
const appId = parseInt(params.get("app_id") ?? "")
const transportOverride = params.get("transport")

function StreamPage() {
    const containerRef = useRef<HTMLDivElement>(null)
    const streamRef = useRef<Stream | null>(null)
    const [status, setStatus] = useState("Connecting…")
    const [videoReady, setVideoReady] = useState(false)
    const [pointerLocked, setPointerLocked] = useState(false)

    useEffect(() => {
        if (!containerRef.current || Number.isNaN(hostId) || Number.isNaN(appId)) {
            return
        }
        const container = containerRef.current
        let cancelled = false
        let stream: Stream | null = null

        ;(async () => {
            if (!(await ensureAuthenticated(api))) {
                window.location.href = "/"
                return
            }
            const role = await bootstrapRole(api)
            if (cancelled) {
                return
            }

            const settings = globalDefaultSettings()
            // Native-ish size, aligned down to macroblock (16px) boundaries:
            // odd encode sizes make some hardware decoders (Chrome/D3D11)
            // mishandle the crop padding, which shows up as green artifacts.
            settings.videoSize = "custom"
            if (transportOverride === "websocket" || transportOverride === "webrtc") {
                settings.dataTransport = transportOverride
            }

            const width = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)
            const height = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)
            settings.videoSizeCustom = { width: width & ~15, height: height & ~15 }

            stream = new Stream(api, hostId, appId, settings, [width, height], role.permissions)
            streamRef.current = stream

            stream.addInfoListener((event: InfoEvent) => {
                const info = event.detail
                if (info.type === "connectionStatus") {
                    setStatus(`${info.status}`)
                } else if (info.type === "videoReady") {
                    setVideoReady(true)
                } else if (info.type === "serverMessage") {
                    setStatus(info.message)
                } else if (info.type === "addDebugLine") {
                    console.log("[stream]", info.line)
                    // Fatal engine errors must reach the user, not just the console
                    if (info.additional?.type === "fatal" || info.additional?.type === "fatalDescription") {
                        setStatus(info.line)
                    }
                }
            })

            stream.mount(container)
            await stream.startConnection()
        })()

        // -- Input forwarding (P1: keyboard + mouse; touch/gamepad in P4)
        const input = () => streamRef.current?.getInput()
        const rect = () => container.getBoundingClientRect()
        const onKeyDown = (e: KeyboardEvent) => input()?.onKeyDown(e)
        const onKeyUp = (e: KeyboardEvent) => input()?.onKeyUp(e)
        const onMouseDown = (e: MouseEvent) => {
            container.focus()
            streamRef.current?.getVideoRenderer()?.onUserInteraction()
            streamRef.current?.getAudioPlayer()?.onUserInteraction()
            input()?.onMouseDown(e, rect())
        }
        const onMouseUp = (e: MouseEvent) => input()?.onMouseUp(e)
        const onMouseMove = (e: MouseEvent) => input()?.onMouseMove(e, rect())
        const onWheel = (e: WheelEvent) => input()?.onMouseWheel(e)
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
        containerRef.current?.requestPointerLock()
    }

    return (
        <div className="fixed inset-0 bg-abyss">
            <div ref={containerRef} tabIndex={0}
                className={`absolute inset-0 outline-none [&_video]:w-full [&_video]:h-full [&_canvas]:w-full [&_canvas]:h-full ${videoReady ? "cursor-none" : ""}`} />
            {!videoReady && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 rounded-full bg-panel/90 border border-line px-4 py-1.5 text-sm text-fog">
                    {status}
                </div>
            )}
            <div className="absolute top-0 inset-x-0 h-14 group">
                <div className="absolute top-4 left-4 flex gap-2 opacity-0 group-hover:opacity-100 transition">
                    <a href="/" className="rounded-lg bg-panel/80 border border-line px-3 py-1.5 text-sm text-fog hover:text-snow">
                        ← Exit
                    </a>
                    <button onClick={toggleFullscreen} className="rounded-lg bg-panel/80 border border-line px-3 py-1.5 text-sm text-fog hover:text-snow">
                        ⛶ Fullscreen
                    </button>
                    <button onClick={lockMouse} className="rounded-lg bg-panel/80 border border-line px-3 py-1.5 text-sm text-fog hover:text-snow">
                        {pointerLocked ? "Mouse locked (Esc releases)" : "🖱 Lock mouse"}
                    </button>
                </div>
            </div>
        </div>
    )
}

createRoot(document.getElementById("root")!).render(
    // No StrictMode here: the engine Stream is not double-mount safe
    <StreamPage />,
)
