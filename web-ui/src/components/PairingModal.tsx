import { useEffect, useRef, useState } from "react"
import {
    Api,
    apiPostPair,
    apiPostPairCancel,
    DetailedHost,
    PairFailReason,
    UndetailedHost,
} from "../lib/api"
import { Modal } from "./Modal"
import { MoonSpinner } from "./Spinner"
import { IconAlert, IconCheck } from "./icons"

const FAIL_COPY: Record<PairFailReason, { title: string; body: string; retry: boolean }> = {
    PinIncorrect: {
        title: "The PIN didn't match",
        body:
            "Sunshine rejected the PIN. If this keeps happening even though you typed it " +
            "correctly, the host is likely holding on to a stale pairing session — " +
            "restarting Sunshine on the host usually clears it.",
        retry: true,
    },
    TimedOut: {
        title: "Pairing timed out",
        body:
            "The pairing window closed before the PIN was entered on the host. Start " +
            "again and enter the PIN in Sunshine within the time shown.",
        retry: true,
    },
    AlreadyPaired: {
        title: "Already paired",
        body: "Good news: this host is already paired. Refresh it and you should be ready to play.",
        retry: false,
    },
    PairingInProgress: {
        title: "Pairing already in progress",
        body:
            "Another pairing attempt for this host is still running — maybe in another " +
            "tab or by another user. Finish or cancel that one first.",
        retry: false,
    },
    Cancelled: {
        title: "Pairing cancelled",
        body: "The pairing attempt was cancelled before it finished.",
        retry: true,
    },
    HostUnreachable: {
        title: "Can't reach the host",
        body:
            "The host didn't answer. Make sure the machine is awake, connected to the " +
            "network, and that Sunshine is running.",
        retry: true,
    },
    Internal: {
        title: "Pairing failed",
        body: "Something unexpected went wrong on the server while pairing.",
        retry: true,
    },
}

type PairPhase =
    | { kind: "starting" }
    | { kind: "pin"; pin: string; deadline: number; totalSecs: number }
    | { kind: "paired"; host: DetailedHost }
    | { kind: "failed"; title: string; body: string; detail: string | null; retry: boolean }

/**
 * The pairing flow: starts `POST /pair` on mount, shows the streamed PIN in
 * huge type with a live countdown ring, lets the user cancel mid-flight, and
 * translates every PairFailReason into plain English.
 */
export function PairingModal({
    api,
    host,
    onClose,
    onPaired,
}: {
    api: Api
    host: UndetailedHost
    onClose: () => void
    /** Called once the host reports Paired (after a short success beat). */
    onPaired: (host: DetailedHost) => void
}) {
    const [phase, setPhase] = useState<PairPhase>({ kind: "starting" })
    const [cancelling, setCancelling] = useState(false)
    const [attempt, setAttempt] = useState(0)
    const cancelledByUser = useRef(false)

    useEffect(() => {
        let disposed = false
        cancelledByUser.current = false
        setCancelling(false)
        setPhase({ kind: "starting" })

        function fail(reason: PairFailReason, detail: string | null) {
            const copy = FAIL_COPY[reason] ?? FAIL_COPY.Internal
            setPhase({
                kind: "failed",
                title: copy.title,
                body: copy.body,
                // Reasons with a dedicated message are self-explanatory; for the
                // catch-all, surface the technical detail for bug reports.
                detail: reason === "Internal" ? detail : null,
                retry: copy.retry,
            })
        }

        ;(async () => {
            let stream
            try {
                stream = await apiPostPair(api, { host_id: host.host_id })
            } catch {
                if (!disposed) {
                    setPhase({
                        kind: "failed",
                        title: "Couldn't start pairing",
                        body: "The server didn't respond to the pairing request. Check your connection and try again.",
                        detail: null,
                        retry: true,
                    })
                }
                return
            }

            const stage1 = stream.response
            if (disposed) {
                return
            }
            if (stage1 == null || typeof stage1 === "string") {
                // Legacy servers reply "InternalServerError" | "PairError"
                fail("Internal", typeof stage1 === "string" ? stage1 : null)
                return
            }
            if ("PairFailed" in stage1) {
                fail(stage1.PairFailed.reason, stage1.PairFailed.detail)
                return
            }

            const totalSecs = Number(stage1.Pin.expires_in_secs)
            setPhase({
                kind: "pin",
                pin: stage1.Pin.pin,
                deadline: Date.now() + totalSecs * 1000,
                totalSecs,
            })

            let stage2
            try {
                stage2 = await stream.next()
            } catch {
                stage2 = null
            }
            if (disposed) {
                return
            }
            if (stage2 == null) {
                if (cancelledByUser.current) {
                    onClose()
                    return
                }
                setPhase({
                    kind: "failed",
                    title: "Connection lost",
                    body: "The connection to the server dropped while waiting for the host. The pairing attempt may not have completed.",
                    detail: null,
                    retry: true,
                })
                return
            }
            if (typeof stage2 === "string") {
                fail("Internal", stage2)
                return
            }
            if ("PairFailed" in stage2) {
                const { reason, detail } = stage2.PairFailed
                if (reason === "Cancelled" && cancelledByUser.current) {
                    onClose()
                    return
                }
                fail(reason, detail)
                return
            }
            setPhase({ kind: "paired", host: stage2.Paired })
        })()

        return () => {
            disposed = true
        }
    }, [attempt]) // eslint-disable-line react-hooks/exhaustive-deps

    // Success beat: show the check briefly, then hand the paired host back.
    useEffect(() => {
        if (phase.kind !== "paired") {
            return
        }
        const timer = window.setTimeout(() => onPaired(phase.host), 1100)
        return () => window.clearTimeout(timer)
    }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

    async function cancel() {
        if (cancelling) {
            return
        }
        cancelledByUser.current = true
        setCancelling(true)
        try {
            await apiPostPairCancel(api, { host_id: host.host_id })
            // The pair stream now settles with PairFailed(Cancelled) and the
            // flow above closes the modal.
        } catch {
            // Couldn't reach the cancel endpoint; don't trap the user in the
            // modal. The attempt will time out on its own server-side.
            onClose()
        }
    }

    function dismiss() {
        if (phase.kind === "failed") {
            onClose()
        } else if (phase.kind !== "paired") {
            void cancel()
        }
    }

    return (
        <Modal onClose={dismiss} dismissable={phase.kind !== "paired" && !cancelling} width="w-[28rem]" labelledBy="pair-title">
            <div className="flex flex-col items-center p-8 text-center">
                {phase.kind === "starting" && (
                    <>
                        <h2 id="pair-title" className="text-lg font-semibold tracking-tight">
                            Pairing with {host.name}
                        </h2>
                        <div className="my-10 text-moon">
                            <MoonSpinner size={44} />
                        </div>
                        <p className="text-sm text-fog">Requesting a PIN from the server…</p>
                        <button
                            onClick={cancel}
                            disabled={cancelling}
                            className="focus-ring mt-8 rounded-lg border border-line px-5 py-2 text-sm text-fog
                                transition hover:border-fog hover:text-snow disabled:opacity-50"
                        >
                            {cancelling ? "Cancelling…" : "Cancel"}
                        </button>
                    </>
                )}

                {phase.kind === "pin" && (
                    <PinStage
                        hostName={host.name}
                        pin={phase.pin}
                        deadline={phase.deadline}
                        totalSecs={phase.totalSecs}
                        cancelling={cancelling}
                        onCancel={cancel}
                    />
                )}

                {phase.kind === "paired" && (
                    <>
                        <span
                            className="my-6 flex size-20 items-center justify-center rounded-full
                                border border-moon/40 text-moon shadow-moonglow animate-modal-in"
                        >
                            <IconCheck size={38} />
                        </span>
                        <h2 id="pair-title" className="text-lg font-semibold tracking-tight">
                            Paired with {phase.host.name}
                        </h2>
                        <p className="mt-2 text-sm text-fog">Opening the library…</p>
                    </>
                )}

                {phase.kind === "failed" && (
                    <>
                        <span
                            className="my-4 flex size-16 items-center justify-center rounded-full
                                border border-red-400/40 bg-red-950/40 text-red-300"
                        >
                            <IconAlert size={30} />
                        </span>
                        <h2 id="pair-title" className="text-lg font-semibold tracking-tight">
                            {phase.title}
                        </h2>
                        <p className="mt-3 max-w-sm text-sm leading-relaxed text-fog">{phase.body}</p>
                        {phase.detail && (
                            <p className="mt-3 max-w-sm rounded-lg bg-panel-2 px-3 py-2 font-mono text-xs text-fog">
                                {phase.detail}
                            </p>
                        )}
                        <div className="mt-8 flex gap-3">
                            <button
                                onClick={onClose}
                                className="focus-ring rounded-lg border border-line px-5 py-2 text-sm text-fog
                                    transition hover:border-fog hover:text-snow"
                            >
                                Close
                            </button>
                            {phase.retry && (
                                <button
                                    autoFocus
                                    onClick={() => setAttempt(current => current + 1)}
                                    className="focus-ring rounded-lg bg-moon px-5 py-2 text-sm font-medium
                                        text-abyss transition hover:bg-moon/85"
                                >
                                    Try again
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </Modal>
    )
}

function PinStage({
    hostName,
    pin,
    deadline,
    totalSecs,
    cancelling,
    onCancel,
}: {
    hostName: string
    pin: string
    deadline: number
    totalSecs: number
    cancelling: boolean
    onCancel: () => void
}) {
    const [now, setNow] = useState(() => Date.now())

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 200)
        return () => window.clearInterval(timer)
    }, [])

    const remaining = Math.max(0, (deadline - now) / 1000)
    const fraction = totalSecs > 0 ? remaining / totalSecs : 0
    const seconds = Math.ceil(remaining)

    const RADIUS = 30
    const CIRCUMFERENCE = 2 * Math.PI * RADIUS
    const ringColor =
        seconds <= 6 ? "#f87171" : seconds <= 15 ? "var(--color-ember)" : "var(--color-moon)"

    return (
        <>
            <h2 id="pair-title" className="text-lg font-semibold tracking-tight">
                Pairing with {hostName}
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-fog">
                Open Sunshine's web UI on the host and enter this PIN on the <b className="text-snow">PIN</b> tab.
            </p>

            {/* The PIN, in lights */}
            <div className="mt-7 flex gap-3" aria-label={`PIN ${pin.split("").join(" ")}`}>
                {pin.split("").map((digit, index) => (
                    <span
                        key={index}
                        style={{ animationDelay: `${index * 70}ms` }}
                        className="tabular flex h-20 w-16 items-center justify-center rounded-xl border
                            border-moon/35 bg-panel-2 text-[2.6rem] font-bold text-snow shadow-moonglow
                            animate-rise [text-shadow:0_0_18px_rgba(122,162,255,0.55)]"
                    >
                        {digit}
                    </span>
                ))}
            </div>

            {/* Countdown ring */}
            <div className="mt-7 flex flex-col items-center gap-1.5" role="timer" aria-label={`PIN expires in ${seconds} seconds`}>
                <div className="relative size-[72px]">
                    <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
                        <circle cx="36" cy="36" r={RADIUS} fill="none" stroke="var(--color-line)" strokeWidth="4" />
                        <circle
                            cx="36"
                            cy="36"
                            r={RADIUS}
                            fill="none"
                            stroke={ringColor}
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeDasharray={CIRCUMFERENCE}
                            strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
                            style={{ transition: "stroke-dashoffset 0.2s linear, stroke 0.4s" }}
                        />
                    </svg>
                    <span
                        className="tabular absolute inset-0 flex items-center justify-center text-lg font-semibold"
                        style={{ color: ringColor }}
                    >
                        {seconds}
                    </span>
                </div>
                <span className="text-xs tracking-wide text-fog uppercase">
                    {seconds > 0 ? "seconds left" : "waiting for host…"}
                </span>
            </div>

            <button
                onClick={onCancel}
                disabled={cancelling}
                className="focus-ring mt-8 rounded-lg border border-line px-5 py-2 text-sm text-fog
                    transition hover:border-fog hover:text-snow disabled:opacity-50"
            >
                {cancelling ? "Cancelling…" : "Cancel pairing"}
            </button>
        </>
    )
}
