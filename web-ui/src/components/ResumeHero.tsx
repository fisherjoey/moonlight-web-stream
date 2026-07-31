import { useState } from "react"
import { App, appImageUrl } from "../lib/api"
import { IconPlay } from "./icons"

/**
 * Wide "pick up where you left off" hero shown above the library when the
 * host already has a game running. Same destination as resuming from the
 * grid tile — this is just a more prominent entry point to it.
 */
export function ResumeHero({
    app,
    hostId,
    onLaunch,
}: {
    app: App
    hostId: number
    onLaunch: (app: App) => void
}) {
    const [artFailed, setArtFailed] = useState(false)

    return (
        <a
            data-tile
            href={`stream.html?host_id=${hostId}&app_id=${app.app_id}`}
            onClick={() => onLaunch(app)}
            aria-label={`Continue ${app.title} — running now, click to resume`}
            className="focus-ring group relative mb-8 flex h-44 w-full overflow-hidden rounded-tile
                border border-moon/50 shadow-moonglow transition duration-200 ease-out
                hover:-translate-y-0.5 hover:shadow-moonglow-lg sm:h-52"
        >
            {!artFailed ? (
                <img
                    src={appImageUrl(hostId, app.app_id)}
                    alt=""
                    onError={() => setArtFailed(true)}
                    className="absolute inset-0 size-full object-cover object-top opacity-70 transition
                        duration-300 ease-out group-hover:scale-[1.03] group-hover:opacity-80"
                />
            ) : (
                <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-panel-2 to-panel" />
            )}

            {/* Legibility scrim */}
            <span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-abyss via-abyss/55
                    to-transparent"
            />

            <span className="relative z-10 mt-auto flex w-full items-end justify-between gap-4 p-6">
                <span className="flex flex-col gap-2">
                    <span
                        className="flex items-center gap-2 text-xs font-semibold tracking-wide text-moon
                            uppercase"
                    >
                        <span aria-hidden className="size-1.5 rounded-full bg-moon animate-pulse-dot" />
                        Continue
                    </span>
                    <span className="text-2xl font-bold tracking-tight text-snow sm:text-3xl">{app.title}</span>
                </span>
                <span
                    aria-hidden
                    className="mb-1 flex size-12 shrink-0 items-center justify-center rounded-full border
                        border-moon/50 bg-abyss/70 text-moon shadow-moonglow backdrop-blur-sm transition
                        group-hover:bg-moon group-hover:text-abyss"
                >
                    <IconPlay size={20} />
                </span>
            </span>
        </a>
    )
}
