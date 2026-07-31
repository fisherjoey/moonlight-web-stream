import { useEffect, useRef, useState } from "react"
import type { StreamPermissions } from "@engine/api_bindings"
import { KEYCODE_COMBOS } from "./keycodes"
import {
    CODEC_CHOICES,
    FPS_CHOICES,
    InputDraft,
    MOUSE_SCROLL_MODE_CHOICES,
    QualityDraft,
    RESOLUTION_CHOICES,
    TRANSPORT_CHOICES,
    bitrateSliderMaxMbps,
    sameQuality,
} from "./settings"

const AUTO_HIDE_MS = 2500

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <div className="mt-6 mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-fog/80">
            {children}
        </div>
    )
}

function Segmented<T extends string | number>({ options, value, onChange }: {
    options: Array<{ value: T; label: string }>
    value: T
    onChange: (value: T) => void
}) {
    return (
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(options.length, 5)}, minmax(0, 1fr))` }}>
            {options.map(option => {
                const active = option.value === value
                return (
                    <button key={String(option.value)} type="button"
                        onClick={() => onChange(option.value)}
                        className={`rounded-lg border px-1 py-1.5 text-xs font-medium transition outline-none
                            focus-visible:border-moon
                            ${active
                                ? "border-moon/60 bg-moon/15 text-moon shadow-[0_0_12px_rgba(122,162,255,0.15)]"
                                : "border-line bg-panel-2/50 text-fog hover:border-moon/40 hover:text-snow"}`}>
                        {option.label}
                    </button>
                )
            })}
        </div>
    )
}

function ActionButton({ onClick, children, hint }: {
    onClick: () => void
    children: React.ReactNode
    hint?: string
}) {
    return (
        <button type="button" onClick={onClick}
            className="flex w-full items-center justify-between rounded-lg border border-line bg-panel-2/50
                px-3 py-2 text-left text-sm text-snow transition outline-none
                hover:border-moon/50 hover:bg-panel-2 focus-visible:border-moon">
            <span>{children}</span>
            {hint && <span className="text-[10px] uppercase tracking-wider text-fog/70">{hint}</span>}
        </button>
    )
}

function Toggle({ label, on, onChange, disabled, hint }: {
    label: string
    on: boolean
    onChange: () => void
    disabled?: boolean
    hint?: string
}) {
    return (
        <button type="button" onClick={onChange} disabled={disabled}
            className={`flex w-full items-center justify-between rounded-lg border border-line bg-panel-2/50
                px-3 py-2 text-left text-sm text-snow transition outline-none
                ${disabled
                    ? "cursor-not-allowed opacity-40"
                    : "hover:border-moon/50 hover:bg-panel-2 focus-visible:border-moon"}`}>
            <span className="flex flex-col">
                <span>{label}</span>
                {hint && <span className="text-[10px] text-fog/70">{hint}</span>}
            </span>
            <span className={`relative h-4 w-8 shrink-0 rounded-full transition ${on ? "bg-moon/80" : "bg-line"}`}>
                <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-snow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
            </span>
        </button>
    )
}

export function OverlayMenu({
    open, onClose,
    appTitle,
    isFullscreen, onToggleFullscreen, onPictureInPicture,
    pointerLocked, onLockMouse,
    statsVisible, onToggleStats,
    activeQuality, permissions,
    onApply, onDisconnect,
    onSendKeycode,
    inputConfig, onInputConfigChange,
}: {
    open: boolean
    onClose: () => void
    appTitle: string | null
    isFullscreen: boolean
    onToggleFullscreen: () => void
    onPictureInPicture?: () => void
    pointerLocked: boolean
    onLockMouse: () => void
    statsVisible: boolean
    onToggleStats: () => void
    activeQuality: QualityDraft
    permissions: StreamPermissions | null
    onApply: (draft: QualityDraft) => void
    onDisconnect: () => void
    /** Sends a "Send Keycode" combo (see keycodes.ts) as raw VK down/up events. */
    onSendKeycode: (keys: number[]) => void
    inputConfig: InputDraft
    /** Applies a partial Input-settings patch live (StreamInput.setConfig) and persists it. */
    onInputConfigChange: (patch: Partial<InputDraft>) => void
}) {
    const [draft, setDraft] = useState<QualityDraft>(activeQuality)
    const hideTimerRef = useRef<number | null>(null)

    // Re-seed the draft from the live settings each time the menu opens.
    useEffect(() => {
        if (open) {
            setDraft(activeQuality)
        }
    }, [open, activeQuality])

    // Auto-hide once the pointer has left the panel for a while.
    useEffect(() => {
        return () => {
            if (hideTimerRef.current != null) {
                window.clearTimeout(hideTimerRef.current)
            }
        }
    }, [])
    const cancelAutoHide = () => {
        if (hideTimerRef.current != null) {
            window.clearTimeout(hideTimerRef.current)
            hideTimerRef.current = null
        }
    }
    const scheduleAutoHide = () => {
        cancelAutoHide()
        hideTimerRef.current = window.setTimeout(onClose, AUTO_HIDE_MS)
    }

    const dirty = !sameQuality(draft, activeQuality)
    const maxMbps = permissions ? bitrateSliderMaxMbps(permissions) : 150
    const draftMbps = Math.max(1, Math.min(maxMbps, Math.round(draft.bitrateKbps / 1000)))

    const codecOptions = CODEC_CHOICES.filter(choice =>
        choice.value === "auto" ||
        !permissions ||
        (choice.value === "h264" && permissions.allow_codec_h264) ||
        (choice.value === "h265" && permissions.allow_codec_h265) ||
        (choice.value === "av1" && permissions.allow_codec_av1))
    const transportOptions = TRANSPORT_CHOICES.filter(choice =>
        choice.value === "auto" ||
        !permissions ||
        (choice.value === "webrtc" && permissions.allow_transport_webrtc) ||
        (choice.value === "websocket" && permissions.allow_transport_websockets))

    return (
        <div aria-hidden={!open}
            onMouseEnter={cancelAutoHide}
            onMouseLeave={() => { if (open) scheduleAutoHide() }}
            className={`fixed inset-y-0 right-0 z-40 flex w-[21.5rem] flex-col
                border-l border-line bg-panel/95 backdrop-blur-xl
                shadow-[-24px_0_60px_rgba(0,0,0,0.55)]
                transition-transform duration-300 ease-out
                ${open ? "translate-x-0" : "pointer-events-none translate-x-full"}`}>

            {/* Header */}
            <div className="flex items-start justify-between border-b border-line px-5 pb-4 pt-5">
                <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-moon">
                        Now streaming
                    </div>
                    <div className="mt-1 truncate text-base font-semibold tracking-tight text-snow">
                        {appTitle ?? "Unknown app"}
                    </div>
                </div>
                <button type="button" onClick={onClose} aria-label="Close menu"
                    className="ml-3 rounded-lg border border-line px-2 py-1 text-sm text-fog transition
                        hover:border-moon/50 hover:text-snow">
                    ✕
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-5">
                <SectionLabel>Session</SectionLabel>
                <div className="flex flex-col gap-2">
                    <ActionButton onClick={onToggleFullscreen}>
                        {isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                    </ActionButton>
                    <ActionButton onClick={onLockMouse} hint={pointerLocked ? "Esc releases" : undefined}>
                        {pointerLocked ? "Mouse locked" : "Lock mouse"}
                    </ActionButton>
                    {onPictureInPicture && (
                        <ActionButton onClick={onPictureInPicture} hint="floating window">
                            Picture-in-Picture
                        </ActionButton>
                    )}
                    <Toggle label="Stats overlay" on={statsVisible} onChange={onToggleStats} />
                </div>

                <SectionLabel>Send keycode</SectionLabel>
                <div className="grid grid-cols-2 gap-1.5">
                    {KEYCODE_COMBOS.map(combo => (
                        <button key={combo.id} type="button" onClick={() => onSendKeycode(combo.keys)}
                            className="rounded-lg border border-line bg-panel-2/50 px-2 py-1.5 text-xs font-medium
                                text-fog transition outline-none
                                hover:border-moon/50 hover:bg-panel-2 hover:text-snow focus-visible:border-moon">
                            {combo.label}
                        </button>
                    ))}
                </div>

                <SectionLabel>Quality</SectionLabel>
                <div className="flex flex-col gap-4">
                    <div>
                        <div className="mb-1.5 flex items-baseline justify-between">
                            <span className="text-xs text-fog">Bitrate</span>
                            <span className="font-mono text-xs text-snow tabular-nums">{draftMbps} Mb/s</span>
                        </div>
                        <input type="range" min={1} max={maxMbps} step={1} value={draftMbps}
                            onChange={e => setDraft({ ...draft, bitrateKbps: Number(e.target.value) * 1000 })}
                            className="w-full accent-moon" />
                    </div>
                    <div>
                        <div className="mb-1.5 text-xs text-fog">Resolution</div>
                        <Segmented options={RESOLUTION_CHOICES} value={draft.resolution}
                            onChange={resolution => setDraft({ ...draft, resolution })} />
                    </div>
                    <div>
                        <div className="mb-1.5 text-xs text-fog">Frame rate</div>
                        <Segmented options={FPS_CHOICES.map(fps => ({ value: fps, label: `${fps}` }))}
                            value={draft.fps} onChange={fps => setDraft({ ...draft, fps })} />
                    </div>
                    <div>
                        <div className="mb-1.5 text-xs text-fog">Codec</div>
                        <Segmented options={codecOptions} value={draft.codec}
                            onChange={codec => setDraft({ ...draft, codec })} />
                    </div>
                    <div>
                        <div className="mb-1.5 text-xs text-fog">Transport</div>
                        <Segmented options={transportOptions} value={draft.transport}
                            onChange={transport => setDraft({ ...draft, transport })} />
                    </div>
                    <Toggle label="Play audio on host" on={draft.playAudioLocal}
                        onChange={() => setDraft({ ...draft, playAudioLocal: !draft.playAudioLocal })} />
                    <Toggle label="HDR" on={draft.hdr}
                        disabled={permissions != null && !permissions.allow_hdr}
                        hint={permissions != null && !permissions.allow_hdr ? "Not allowed for this role" : undefined}
                        onChange={() => setDraft({ ...draft, hdr: !draft.hdr })} />

                    {dirty && (
                        <div className="rounded-xl border border-moon/30 bg-moon/10 p-3">
                            <button type="button" onClick={() => onApply(draft)}
                                className="w-full rounded-lg bg-moon py-2 text-sm font-semibold text-abyss
                                    shadow-[0_0_24px_rgba(122,162,255,0.35)] transition hover:bg-moon/90">
                                Apply & reconnect
                            </button>
                            <p className="mt-2 text-center text-[11px] leading-snug text-fog">
                                Restarts the stream with the new settings.
                            </p>
                        </div>
                    )}
                </div>

                <SectionLabel>Input</SectionLabel>
                <div className="flex flex-col gap-4">
                    <div>
                        <div className="mb-1.5 text-xs text-fog">Mouse scroll</div>
                        <Segmented options={MOUSE_SCROLL_MODE_CHOICES} value={inputConfig.mouseScrollMode}
                            onChange={mouseScrollMode => onInputConfigChange({ mouseScrollMode })} />
                    </div>
                    <div className="flex flex-col gap-2">
                        <Toggle label="Invert controller A/B" on={inputConfig.invertAB}
                            onChange={() => onInputConfigChange({ invertAB: !inputConfig.invertAB })} />
                        <Toggle label="Invert controller X/Y" on={inputConfig.invertXY}
                            onChange={() => onInputConfigChange({ invertXY: !inputConfig.invertXY })} />
                    </div>
                </div>

                <SectionLabel>Connection</SectionLabel>
                <button type="button" onClick={onDisconnect}
                    className="w-full rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm
                        font-medium text-red-400 transition hover:border-red-400 hover:bg-red-500/20">
                    Disconnect
                </button>
            </div>

            <div className="border-t border-line px-5 py-3 text-center text-[10px] tracking-wide text-fog/70">
                Ctrl+Shift+M or hover the right edge to toggle this menu
            </div>
        </div>
    )
}
