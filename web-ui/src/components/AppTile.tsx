import { useState } from "react"
import { App, appImageUrl } from "../lib/api"
import { IconStar, IconStop } from "./icons"

/**
 * Cover-art launcher tile. Falls back to a generated monogram card when the
 * host has no art for the app. The running app gets a pulsing badge and a
 * stop control; while something is running, other tiles step back a little.
 *
 * The favorite star and stop button live as siblings of the `<a>` (not
 * nested inside it — a `<button>` inside an `<a>` is invalid HTML and
 * fights the browser for the click), stacked in the tile's top-right
 * corner. `compact` shrinks the tile for lower-emphasis rows (Recent).
 */
export function AppTile({
    app,
    hostId,
    running,
    anyRunning,
    favorite,
    onQuit,
    onToggleFavorite,
    onLaunch,
    compact = false,
}: {
    app: App
    hostId: number
    running: boolean
    anyRunning: boolean
    favorite: boolean
    onQuit: (app: App) => void
    onToggleFavorite: (app: App) => void
    /** Fired when the tile is actually used to launch/resume the app (records "recent"). */
    onLaunch?: (app: App) => void
    compact?: boolean
}) {
    const [artFailed, setArtFailed] = useState(false)
    const width = compact ? "w-32" : "w-44"

    return (
        <div className={`group relative transition duration-200 ${anyRunning && !running ? "opacity-60" : ""}`}>
            <a
                data-tile
                href={`stream.html?host_id=${hostId}&app_id=${app.app_id}`}
                onClick={() => onLaunch?.(app)}
                aria-label={running ? `${app.title} — running, click to resume` : `Play ${app.title}`}
                className={`focus-ring block ${width} overflow-hidden rounded-tile border bg-panel
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
                                className={`flex items-center justify-center rounded-2xl border
                                    border-moon/30 font-bold text-moon
                                    ${compact ? "size-10 text-lg" : "size-14 text-2xl"}`}
                            >
                                {(app.title.trim()[0] ?? "?").toUpperCase()}
                            </span>
                            {!compact && (
                                <span className="line-clamp-3 text-center text-sm font-medium text-fog">
                                    {app.title}
                                </span>
                            )}
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
                <div className={`truncate px-3 py-2.5 font-medium ${compact ? "text-xs" : "text-sm"}`}>
                    {app.title}
                </div>
            </a>

            {/* Favorite + stop controls, stacked top-right */}
            <div className="absolute right-2.5 top-2.5 flex flex-col items-end gap-2">
                <button
                    onClick={() => onToggleFavorite(app)}
                    aria-pressed={favorite}
                    aria-label={favorite ? `Remove ${app.title} from favorites` : `Add ${app.title} to favorites`}
                    title={favorite ? "Remove from favorites" : "Add to favorites"}
                    className={`focus-ring flex items-center justify-center rounded-full border p-1.5
                        backdrop-blur-sm transition ${
                            favorite
                                ? "border-ember/50 bg-abyss/80 text-ember opacity-100"
                                : `border-line/70 bg-abyss/70 text-fog opacity-0 hover:border-ember/50
                                   hover:text-ember group-hover:opacity-100 group-focus-within:opacity-100`
                        }`}
                >
                    <IconStar size={compact ? 12 : 14} fill={favorite ? "currentColor" : "none"} />
                </button>

                {running && (
                    <button
                        onClick={() => onQuit(app)}
                        aria-label={`Stop ${app.title}`}
                        title="Stop this session"
                        className="focus-ring flex items-center justify-center rounded-full border
                            border-red-400/40 bg-abyss/80 p-1.5 text-red-300 backdrop-blur-sm transition
                            hover:bg-red-400/20"
                    >
                        <IconStop size={compact ? 13 : 15} />
                    </button>
                )}
            </div>
        </div>
    )
}
