import {
    Settings,
    StreamCodec,
    TransportType,
    getLocalStreamSettings,
    setLocalStreamSettings,
} from "@engine/component/settings_menu"
import type { StreamPermissions } from "@engine/api_bindings"

/**
 * Settings persistence reuses the engine's storage ("mlSettings" key, full
 * Settings shape via getLocalStreamSettings/setLocalStreamSettings) so
 * user preferences survive switching between the old and new UI.
 */

export type ResolutionChoice = "720p" | "1080p" | "1440p" | "4k" | "native"

export const RESOLUTION_CHOICES: Array<{ value: ResolutionChoice; label: string }> = [
    { value: "720p", label: "720p" },
    { value: "1080p", label: "1080p" },
    { value: "1440p", label: "1440p" },
    { value: "4k", label: "4K" },
    { value: "native", label: "Native" },
]

export const FPS_CHOICES = [30, 60, 120]

export const CODEC_CHOICES: Array<{ value: StreamCodec; label: string }> = [
    { value: "auto", label: "Auto" },
    { value: "h264", label: "H.264" },
    { value: "h265", label: "H.265" },
    { value: "av1", label: "AV1" },
]

export const TRANSPORT_CHOICES: Array<{ value: TransportType; label: string }> = [
    { value: "auto", label: "Auto" },
    { value: "webrtc", label: "WebRTC" },
    { value: "websocket", label: "WebSocket" },
]

/** The quality-relevant slice of Settings the in-stream menu edits. */
export type QualityDraft = {
    bitrateKbps: number
    resolution: ResolutionChoice
    fps: number
    codec: StreamCodec
    transport: TransportType
}

export function qualityFromSettings(settings: Settings): QualityDraft {
    const resolution: ResolutionChoice =
        settings.videoSize === "720p" || settings.videoSize === "1080p" ||
        settings.videoSize === "1440p" || settings.videoSize === "4k"
            ? settings.videoSize
            // "native" and legacy "custom" both render as viewport-native here
            : "native"
    return {
        bitrateKbps: settings.bitrate,
        resolution,
        fps: settings.fps,
        codec: settings.videoCodec,
        transport: settings.dataTransport,
    }
}

export function applyQualityToSettings(base: Settings, draft: QualityDraft): Settings {
    const next: Settings = structuredClone(base)
    next.bitrate = draft.bitrateKbps
    next.fps = draft.fps
    next.videoCodec = draft.codec
    next.dataTransport = draft.transport
    next.videoSize = draft.resolution === "native" ? "native" : draft.resolution
    return next
}

export function sameQuality(a: QualityDraft, b: QualityDraft): boolean {
    return a.bitrateKbps === b.bitrateKbps && a.resolution === b.resolution &&
        a.fps === b.fps && a.codec === b.codec && a.transport === b.transport
}

/**
 * Browser viewport size aligned down to macroblock (16px) boundaries: odd
 * encode sizes make some hardware decoders (Chrome/D3D11) mishandle the
 * crop padding, which shows up as green artifacts.
 */
export function alignedViewportSize(): { width: number; height: number } {
    const width = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0)
    const height = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)
    return { width: width & ~15, height: height & ~15 }
}

/** Same launch-time query overrides the old UI supported, plus the phase-1 `transport` param. */
export function parseSettingsFromQuery(params: URLSearchParams): Partial<Settings> {
    const overrides: Partial<Settings> = {}

    const bitrate = params.get("bitrate")
    if (bitrate) {
        overrides.bitrate = Number(bitrate)
    }
    const fps = params.get("fps")
    if (fps) {
        overrides.fps = Number(fps)
    }
    const hdr = params.get("hdr")
    if (hdr != null) {
        overrides.hdr = hdr === "true"
    }
    const videoSize = params.get("videoSize")
    if (videoSize) {
        overrides.videoSize = videoSize as Settings["videoSize"]
    }
    const width = params.get("videoSizeCustom.width")
    const height = params.get("videoSizeCustom.height")
    if (width && height) {
        overrides.videoSizeCustom = { width: Number(width), height: Number(height) }
    }
    const transport = params.get("dataTransport") ?? params.get("transport")
    if (transport === "auto" || transport === "webrtc" || transport === "websocket") {
        overrides.dataTransport = transport
    }

    return overrides
}

/** Query params that shadow persisted quality settings; dropped on "Apply & reconnect". */
export const QUALITY_QUERY_KEYS = [
    "transport", "dataTransport", "bitrate", "fps", "hdr",
    "videoSize", "videoSizeCustom.width", "videoSizeCustom.height",
]

/** Stored defaults + role defaults + user prefs + launch-time query overrides. */
export function loadStreamSettings(roleDefaultSettings: unknown, params: URLSearchParams): Settings {
    const stored = getLocalStreamSettings(roleDefaultSettings as Settings)
    return { ...stored, ...parseSettingsFromQuery(params) }
}

export function persistStreamSettings(settings: Settings) {
    setLocalStreamSettings(settings)
}

/**
 * Clamps settings to what the role's permissions allow (the engine's own
 * makeSettingsValid is not exported). Mirrors its downgrade rules.
 */
export function sanitizeSettings(settings: Settings, permissions: StreamPermissions): Settings {
    const next: Settings = structuredClone(settings)
    if (permissions.maximum_bitrate_kbps != null && next.bitrate > permissions.maximum_bitrate_kbps) {
        next.bitrate = permissions.maximum_bitrate_kbps
    }
    if (!permissions.allow_codec_av1 && next.videoCodec === "av1") {
        next.videoCodec = "h265"
    }
    if (!permissions.allow_codec_h265 && next.videoCodec === "h265") {
        next.videoCodec = "h264"
    }
    if (!permissions.allow_codec_h264 && next.videoCodec === "h264") {
        next.videoCodec = "auto"
    }
    if (!permissions.allow_hdr && next.hdr) {
        next.hdr = false
    }
    if (!permissions.allow_transport_webrtc && next.dataTransport === "webrtc") {
        next.dataTransport = "auto"
    }
    if (!permissions.allow_transport_websockets && next.dataTransport === "websocket") {
        next.dataTransport = "auto"
    }
    return next
}

/**
 * Turns persisted/user-facing settings into what the engine Stream actually
 * consumes: "native" (and legacy "custom") become an explicit 16px-aligned
 * viewport size so the encoder never gets an odd frame size, and the mouse
 * starts in "follow" mode — this UI drives "relative" purely via pointer lock.
 */
export function resolveEngineSettings(settings: Settings): Settings {
    const resolved: Settings = structuredClone(settings)
    if (resolved.videoSize === "native" || resolved.videoSize === "custom") {
        resolved.videoSize = "custom"
        resolved.videoSizeCustom = alignedViewportSize()
    }
    resolved.mouseMode = "follow"
    return resolved
}

/** Bitrate slider bounds (Mbps), honoring the role's cap when set. */
export function bitrateSliderMaxMbps(permissions: StreamPermissions): number {
    const capKbps = permissions.maximum_bitrate_kbps
    if (capKbps == null) {
        return 150
    }
    return Math.max(1, Math.min(150, Math.round(capKbps / 1000)))
}
