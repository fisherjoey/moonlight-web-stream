import { useState } from "react"

function MoonSpinner() {
    return (
        <div className="relative h-14 w-14">
            <div className="absolute inset-0 rounded-full border-2 border-line" />
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent
                border-t-moon shadow-[0_0_18px_rgba(122,162,255,0.25)]"
                style={{ animationDuration: "1.1s" }} />
        </div>
    )
}

export function ConnectingOverlay({ appTitle, status }: {
    appTitle: string | null
    status: string
}) {
    return (
        // pointer-events-none keeps the video container underneath receiving
        // mouse events (audio-unlock clicks, edge-hover menu detection).
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-abyss">
            {/* Faint radial moon glow behind the spinner */}
            <div className="absolute inset-0"
                style={{ background: "radial-gradient(38rem 24rem at 50% 42%, rgba(122,162,255,0.07), transparent 70%)" }} />
            <MoonSpinner />
            <div className="mt-6 text-[10px] font-semibold uppercase tracking-[0.28em] text-moon">
                Connecting
            </div>
            <div className="mt-2 max-w-md truncate px-6 text-lg font-semibold tracking-tight text-snow">
                {appTitle ?? " "}
            </div>
            <div className="mt-1 max-w-lg px-6 text-center text-sm text-fog">{status}</div>
            <a href="/" className="pointer-events-auto mt-10 rounded-lg border border-line px-4 py-1.5
                text-sm text-fog transition hover:border-moon/50 hover:text-snow">
                Cancel
            </a>
        </div>
    )
}

export function EndScreen({ kind, message, logs, onRetry }: {
    kind: "ended" | "error"
    message: string
    logs: string[]
    onRetry: () => void
}) {
    const [showLogs, setShowLogs] = useState(false)
    const error = kind === "error"

    return (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-abyss">
            <div className="pointer-events-none absolute inset-0"
                style={{
                    background: error
                        ? "radial-gradient(38rem 24rem at 50% 40%, rgba(248,113,113,0.06), transparent 70%)"
                        : "radial-gradient(38rem 24rem at 50% 40%, rgba(122,162,255,0.07), transparent 70%)",
                }} />
            <div className="relative w-[26rem] max-w-[calc(100vw-3rem)] rounded-2xl border border-line bg-panel p-8 shadow-2xl">
                <div className={`text-[10px] font-semibold uppercase tracking-[0.28em]
                    ${error ? "text-red-400" : "text-moon"}`}>
                    {error ? "Connection failed" : "Stream ended"}
                </div>
                <h1 className="mt-2 text-xl font-semibold tracking-tight text-snow">
                    {error ? "The stream hit a fatal error" : "The session has ended"}
                </h1>
                <p className="mt-2 break-words text-sm leading-relaxed text-fog">{message}</p>

                <div className="mt-6 flex gap-3">
                    <button type="button" onClick={onRetry}
                        className="flex-1 rounded-lg bg-moon py-2 text-sm font-semibold text-abyss
                            shadow-[0_0_24px_rgba(122,162,255,0.3)] transition hover:bg-moon/90">
                        Retry
                    </button>
                    <a href="/"
                        className="flex-1 rounded-lg border border-line py-2 text-center text-sm text-fog
                            transition hover:border-moon/50 hover:text-snow">
                        Back to hosts
                    </a>
                </div>

                {logs.length > 0 && (
                    <div className="mt-5">
                        <button type="button" onClick={() => setShowLogs(v => !v)}
                            className="text-xs text-fog underline decoration-line underline-offset-4 transition hover:text-snow">
                            {showLogs ? "Hide logs" : "Show logs"}
                        </button>
                        {showLogs && (
                            <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg
                                border border-line bg-abyss/80 p-3 font-mono text-[10px] leading-relaxed text-fog">
                                {logs.join("\n")}
                            </pre>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
