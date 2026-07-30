import { useEffect, useRef, useState } from "react"
import type { StreamStatsData } from "@engine/stream/stats"

export type HudMeta = {
    transportName: string | null
    targetBitrateKbps: number
}

type HudRow = { label: string; value: string; dim?: boolean }

function fmt(value: number | null | undefined, suffix = "", digits = 1): string | null {
    if (value == null || !Number.isFinite(value)) {
        return null
    }
    return `${value.toFixed(digits)}${suffix}`
}

/**
 * Derives the compact HUD rows from the engine's StreamStatsData snapshot.
 * `prev` is the previous snapshot (for delta-based estimates).
 */
function buildRows(
    stats: StreamStatsData,
    prev: StreamStatsData | null,
    pollMs: number,
    meta: HudMeta,
): HudRow[] {
    const rows: HudRow[] = []

    const liveFps = typeof stats.transport.webrtcFps === "number" ? stats.transport.webrtcFps : null
    rows.push({
        label: "fps",
        value: liveFps != null
            ? `${liveFps.toFixed(0)} / ${stats.videoFps ?? "?"}`
            : `${stats.videoFps ?? "—"}`,
    })

    rows.push({
        label: "res",
        value: stats.videoWidth != null && stats.videoHeight != null
            ? `${stats.videoWidth}×${stats.videoHeight}`
            : "—",
    })

    rows.push({ label: "codec", value: stats.videoCodec ?? "—" })
    rows.push({ label: "transport", value: meta.transportName ?? "—" })
    rows.push({ label: "bitrate", value: `${(meta.targetBitrateKbps / 1000).toFixed(0)} Mb/s target` })

    // Client decode estimate (WebRTC only): delta of cumulative decode time
    // spread over the frames decoded during the poll interval.
    const total = stats.transport.webrtcTotalDecodeTimeMs
    const prevTotal = prev?.transport.webrtcTotalDecodeTimeMs
    if (typeof total === "number" && typeof prevTotal === "number" && liveFps != null && liveFps > 0) {
        const frames = liveFps * (pollMs / 1000)
        const deltaMs = (total - prevTotal) * 1000 // raw value is seconds
        if (deltaMs >= 0 && frames > 0) {
            rows.push({ label: "decode", value: `${(deltaMs / frames).toFixed(2)}ms` })
        }
    }

    const rtt = fmt(stats.streamerRttMs, "ms")
    if (rtt != null) {
        rows.push({ label: "rtt", value: rtt })
    }
    const browserRtt = fmt(stats.browserRtt, "ms")
    if (browserRtt != null) {
        rows.push({ label: "rtt·ws", value: browserRtt })
    }
    const hostProc = fmt(stats.avgHostProcessingLatencyMs, "ms")
    if (hostProc != null) {
        rows.push({ label: "host", value: hostProc, dim: true })
    }
    const streamerProc = fmt(stats.avgStreamerProcessingTimeMs, "ms")
    if (streamerProc != null) {
        rows.push({ label: "streamer", value: streamerProc, dim: true })
    }

    const jitter = stats.transport.webrtcJitterBufferDelayMs
    if (typeof jitter === "number") {
        rows.push({ label: "jitter buf", value: `${jitter.toFixed(2)}`, dim: true })
    }
    const lost = stats.transport.webrtcPacketsLost
    if (typeof lost === "number") {
        rows.push({ label: "pkt lost", value: `${lost}`, dim: true })
    }
    const dropped = stats.transport.webrtcFramesDropped
    if (typeof dropped === "number") {
        rows.push({ label: "dropped", value: `${dropped}`, dim: true })
    }

    if (stats.hdrEnabled != null) {
        rows.push({ label: "hdr", value: stats.hdrEnabled ? "on" : "off", dim: true })
    }

    return rows
}

const POLL_MS = 500

export function StatsHud({ visible, getStats, meta }: {
    visible: boolean
    getStats: () => StreamStatsData | null
    meta: HudMeta
}) {
    const [rows, setRows] = useState<HudRow[]>([])
    const prevRef = useRef<StreamStatsData | null>(null)
    const metaRef = useRef(meta)
    metaRef.current = meta

    useEffect(() => {
        if (!visible) {
            prevRef.current = null
            return
        }
        const tick = () => {
            const stats = getStats()
            if (stats) {
                setRows(buildRows(stats, prevRef.current, POLL_MS, metaRef.current))
                prevRef.current = stats
            }
        }
        tick()
        const id = window.setInterval(tick, POLL_MS)
        return () => window.clearInterval(id)
    }, [visible, getStats])

    if (!visible) {
        return null
    }

    return (
        <div className="pointer-events-none absolute top-4 right-4 z-30 select-none">
            <div className="rounded-xl bg-abyss/75 backdrop-blur-md border border-line/80 px-3.5 py-3
                shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                <div className="mb-2 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-moon shadow-[0_0_6px_rgba(122,162,255,0.9)]" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-fog">stream stats</span>
                </div>
                <table className="font-mono text-[11px] leading-[1.7]">
                    <tbody>
                        {rows.map(row => (
                            <tr key={row.label} className={row.dim ? "text-fog" : "text-snow"}>
                                <td className="pr-4 text-fog/80">{row.label}</td>
                                <td className="text-right tabular-nums">{row.value}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
