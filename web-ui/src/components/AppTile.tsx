import { useState } from "react"
import { App, appImageUrl } from "../lib/api"
import { IconStop } from "./icons"

/**
 * Cover-art launcher tile. Falls back to a generated monogram card when the
 * host has no art for the app. The running app gets a pulsing badge and a
 * stop control; while something is running, other tiles step back a little.
 */
export function AppTile({
    app,
    hostId,
    running,
    anyRunning,
    onQuit,
}: {
    app: App
    hostId: number
    running: boolean
    anyRunning: boolean
    onQuit: (app: App) => void
}) {
    const [artFailed, setArtFailed] = useState(false)

    return (
        <div className={`relative transition duration-200 ${anyRunning && !running ? "opacity-60" : ""}`}>
            <a
                data-tile
                href={`stream.html?host_id=${hostId}&app_id=${app.app_id}`}
                aria-label={running ? `${app.title} — running, click to resume` : `Play ${app.title}`}
                className={`focus-ring group block w-44 overflow-hidden rounded-tile border bg-panel
                    transition duration-200 ease-out hover:-translate-y-1 hover:shadow-moonglow-lg
                    ${running ? "border-moon/50 shadow-moonglow" : "border-line hover:border-moon/40"}`}
            >
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-panel-2">
                    {!artFailed ? (
                        <img
                            src={appImageUrl(hostId, app.app_id)}
                            alt=""
                            loading="lazy"
                            onError={() => setArtFailed(true)}
                            className="size-full object-cover transition duration-300 group-hover:scale-[1.04]"
                        />
                    ) : (
                        <div
                            className="flex size-full flex-col items-center justify-center gap-3 p-4
                                bg-gradient-to-b from-panel-2 to-panel"
                        >
                            <span
                                aria-hidden
                                className="flex size-14 items-center justify-center rounded-2xl border
                                    border-moon/30 text-2xl font-bold text-moon"
                            >
                                {(app.title.trim()[0] ?? "?").toUpperCase()}
                            </span>
                            <span className="line-clamp-3 text-center text-sm font-medium text-fog">
                                {app.title}
                            </span>
                        </div>
                    )}

                    {running && (
                        <span
                            className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full
                                border border-moon/40 bg-abyss/80 px-2.5 py-1 text-[0.7rem] font-medium
                                tracking-wide text-moon backdrop-blur-sm"
                        >
                            <span aria-hidden className="size-1.5 rounded-full bg-moon animate-pulse-dot" />
                            Running
                        </span>
                    )}

                    {/* Hover sheen */}
                    <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-abyss/60
                            via-transparent to-transparent opacity-0 transition group-hover:opacity-100"
                    />
                </div>
                <div className="truncate px-3 py-2.5 text-sm font-medium">{app.title}</div>
            </a>

            {running && (
                <button
                    onClick={() => onQuit(app)}
                    aria-label={`Stop ${app.title}`}
                    title="Stop this session"
                    className="focus-ring absolute right-2.5 top-2.5 flex items-center justify-center
                        rounded-full border border-red-400/40 bg-abyss/80 p-1.5 text-red-300
                        backdrop-blur-sm transition hover:bg-red-400/20"
                >
                    <IconStop size={15} />
                </button>
            )}
        </div>
    )
}
