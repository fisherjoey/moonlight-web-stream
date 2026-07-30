import { useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import "../../styles.css"
import { Api, createApi, ensureAuthenticated, bootstrapRole } from "../../lib/api"
import { Stream, InfoEvent } from "@engine/stream/index"
import { globalDefaultSettings } from "@engine/component/settings_menu"

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
            settings.videoSize = "native"
            if (transportOverride === "websocket" || transportOverride === "webrtc") {
                settings.dataTransport = transportOverride
            }

            const width = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)
            const height = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)

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

        return () => {
            cancelled = true
            document.removeEventListener("keydown", onKeyDown)
            document.removeEventListener("keyup", onKeyUp)
            container.removeEventListener("mousedown", onMouseDown)
            container.removeEventListener("mouseup", onMouseUp)
            container.removeEventListener("mousemove", onMouseMove)
            container.removeEventListener("wheel", onWheel)
            container.removeEventListener("contextmenu", onContextMenu)
            if (stream) {
                stream.stop().catch(() => {})
                stream.unmount(container)
                streamRef.current = null
            }
        }
    }, [])

    return (
        <div className="fixed inset-0 bg-abyss">
            <div ref={containerRef} tabIndex={0}
                className="absolute inset-0 outline-none [&_video]:w-full [&_video]:h-full [&_canvas]:w-full [&_canvas]:h-full" />
            {!videoReady && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 rounded-full bg-panel/90 border border-line px-4 py-1.5 text-sm text-fog">
                    {status}
                </div>
            )}
            <a href="/" className="absolute top-4 left-4 rounded-lg bg-panel/80 border border-line px-3 py-1.5 text-sm text-fog opacity-30 hover:opacity-100 transition">
                ← Exit
            </a>
        </div>
    )
}

createRoot(document.getElementById("root")!).render(
    // No StrictMode here: the engine Stream is not double-mount safe
    <StreamPage />,
)
