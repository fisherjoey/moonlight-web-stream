import { useEffect, useState } from "react"
import type { UndetailedHost } from "../lib/api"
import { IconDots, IconGlobe, IconLock, IconMonitor, IconPlus, IconZap } from "./icons"

export type HostStatus = "ready" | "unpaired" | "offline"

export function hostStatus(host: UndetailedHost): HostStatus {
    if (host.server_state == null) {
        return "offline"
    }
    return host.paired === "Paired" ? "ready" : "unpaired"
}

const STATUS_LABEL: Record<HostStatus, string> = {
    ready: "Ready",
    unpaired: "Not paired",
    offline: "Offline",
}

/** Ticks a "Xs" elapsed counter off a start timestamp while `active`. */
function useElapsedSeconds(since: number | null | undefined): number {
    const [elapsed, setElapsed] = useState(0)

    useEffect(() => {
        if (since == null) {
            setElapsed(0)
            return
        }
        setElapsed(Math.max(0, Math.floor((Date.now() - since) / 1000)))
        const id = window.setInterval(() => {
            setElapsed(Math.max(0, Math.floor((Date.now() - since) / 1000)))
        }, 1000)
        return () => window.clearInterval(id)
    }, [since])

    return elapsed
}

/**
 * One machine on the shelf. Ready hosts glow, offline hosts dim out,
 * unpaired hosts wear a lock. Enter/Space opens, Shift+F10 or the "…"
 * button opens the action menu. While `wakingSince` is set, the tile shows
 * a pulsing amber ring and an elapsed-seconds counter instead of its usual
 * status — clicking it again is how the caller lets the user cancel.
 */
export function HostTile({
    host,
    onOpen,
    onMenu,
    wakingSince = null,
}: {
    host: UndetailedHost
    /** x/y are viewport coordinates of the interaction (for menus). */
    onOpen: (host: UndetailedHost, x: number, y: number) => void
    onMenu: (host: UndetailedHost, x: number, y: number) => void
    /** Date.now() timestamp a wake-up was sent for this host, or null when idle. */
    wakingSince?: number | null
}) {
    const status = hostStatus(host)
    const waking = wakingSince != null
    const elapsed = useElapsedSeconds(wakingSince)

    function tileCenter(target: HTMLElement): [number, number] {
        const rect = target.getBoundingClientRect()
        return [rect.left + rect.width / 2, rect.top + rect.height / 2]
    }

    const ariaStatus = waking ? `Waking up, ${elapsed}s elapsed — click to cancel` : STATUS_LABEL[status]

    return (
        <div
            data-tile
            role="button"
            tabIndex={0}
            aria-label={`${host.name}, ${ariaStatus}`}
            onClick={event => onOpen(host, event.clientX, event.clientY)}
            onKeyDown={event => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    onOpen(host, ...tileCenter(event.currentTarget))
                } else if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
                    event.preventDefault()
                    onMenu(host, ...tileCenter(event.currentTarget))
                }
            }}
            onContextMenu={event => {
                event.preventDefault()
                onMenu(host, event.clientX, event.clientY)
            }}
            className={`focus-ring group relative w-60 cursor-pointer rounded-tile border p-6 text-left
                transition duration-200 ease-out select-none
                ${
                    waking
                        ? "animate-pulse-ring-ember border-ember/60 bg-panel"
                        : status === "ready"
                          ? `border-moon/30 bg-gradient-to-b from-panel-2 to-panel shadow-moonglow
                             hover:-translate-y-0.5 hover:shadow-moonglow-lg`
                          : status === "unpaired"
                            ? "border-line bg-panel hover:-translate-y-0.5 hover:border-ember/50"
                            : "border-line bg-panel opacity-55 saturate-50 hover:opacity-80"
                }`}
        >
            {/* Glyph */}
            <div className="relative mb-5 flex h-16 items-center">
                <IconMonitor
                    size={52}
                    strokeWidth={1.4}
                    className={
                        waking
                            ? "animate-pulse-dot text-ember drop-shadow-[0_0_12px_rgba(240,163,94,0.5)]"
                            : status === "ready"
                              ? "text-moon drop-shadow-[0_0_12px_rgba(122,162,255,0.5)]"
                              : status === "unpaired"
                                ? "text-fog"
                                : "text-line"
                    }
                />
                {waking ? (
                    <span
                        title="Sending Wake-on-LAN…"
                        className="absolute -left-2 -top-2 flex size-7 items-center justify-center
                            rounded-full border border-ember/50 bg-panel-2 text-ember"
                    >
                        <IconZap size={13} />
                    </span>
                ) : (
                    status === "unpaired" && (
                        <span
                            title="Not paired yet"
                            className="absolute -left-2 -top-2 flex size-7 items-center justify-center
                                rounded-full border border-ember/50 bg-panel-2 text-ember"
                        >
                            <IconLock size={13} />
                        </span>
                    )
                )}
            </div>

            {/* Shared badge */}
            {host.owner === "Global" && (
                <span
                    className="absolute right-4 bottom-4 flex items-center gap-1 rounded-full
                        border border-line px-2 py-0.5 text-[0.65rem] tracking-wide text-fog uppercase"
                >
                    <IconGlobe size={10} />
                    Shared
                </span>
            )}

            <div className="truncate text-base font-semibold tracking-tight">{host.name}</div>
            <div className="mt-1 flex items-center gap-2 text-sm text-fog">
                {waking ? (
                    <>
                        <span aria-hidden className="size-2 rounded-full bg-ember animate-pulse-dot" />
                        <span className="text-ember">
                            Waking<span className="tabular">… {elapsed}s</span>
                        </span>
                    </>
                ) : (
                    <>
                        <span
                            aria-hidden
                            className={`size-2 rounded-full ${
                                status === "ready"
                                    ? "bg-moon animate-pulse-dot"
                                    : status === "unpaired"
                                      ? "bg-ember"
                                      : "bg-line"
                            }`}
                        />
                        {STATUS_LABEL[status]}
                    </>
                )}
            </div>

            {/* Action menu button — mouse affordance; keyboard uses Shift+F10 */}
            <button
                tabIndex={-1}
                aria-label={`Actions for ${host.name}`}
                title="Host actions"
                onClick={event => {
                    event.stopPropagation()
                    const rect = event.currentTarget.getBoundingClientRect()
                    onMenu(host, rect.left, rect.bottom + 6)
                }}
                className="absolute right-3 top-3 rounded-lg p-1.5 text-fog opacity-0 transition
                    group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-panel-2 hover:text-snow"
            >
                <IconDots size={18} />
            </button>
        </div>
    )
}

/** Dashed "add a machine" tile at the end of the shelf. */
export function AddHostTile({ onClick }: { onClick: () => void }) {
    return (
        <button
            data-tile
            onClick={onClick}
            className="focus-ring group flex w-60 flex-col items-start justify-between rounded-tile
                border border-dashed border-line p-6 text-left text-fog transition duration-200
                hover:-translate-y-0.5 hover:border-moon/60 hover:text-snow"
        >
            <span
                className="mb-5 flex size-12 items-center justify-center rounded-xl border border-line
                    transition group-hover:border-moon/50 group-hover:text-moon"
            >
                <IconPlus size={22} />
            </span>
            <span>
                <span className="block text-base font-semibold tracking-tight">Add host</span>
                <span className="mt-1 block text-sm text-fog">Pair a new machine</span>
            </span>
        </button>
    )
}
