import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import { ScreenKeyboard as EngineScreenKeyboard } from "@engine/screen_keyboard"
import type { KeyboardModeEvent, TextEvent } from "@engine/screen_keyboard"
import type { StreamInput } from "@engine/stream/input"

export type ScreenKeyboardHandle = {
    show: () => void
    hide: () => void
    isVisible: () => boolean
}

const WAKE_MS = 2500

/**
 * On-screen keyboard for touch sessions.
 *
 * Reuses the engine's ScreenKeyboard (web/screen_keyboard.ts) unmodified
 * instead of rebuilding a QWERTY layout: it's a hidden <textarea> that, once
 * focused, drives the platform's native virtual keyboard and translates its
 * input/composition events into discrete key events and pasted/typed text —
 * already handling IME composition, backspace/delete and line breaks
 * correctly, which a hand-rolled layout would have to reimplement (and would
 * shut out IME users entirely). We just mount its hidden element, forward its
 * key/text events into StreamInput, and render a floating toggle button.
 *
 * Visibility is normally driven by the engine's own three-finger touch
 * gesture (StreamInput.addScreenKeyboardVisibleEvent, wired by the caller
 * through the imperative handle exposed here); the floating button is the
 * fallback entry point for anyone who doesn't discover that gesture.
 */
export const ScreenKeyboard = forwardRef<ScreenKeyboardHandle, {
    getInput: () => StreamInput | undefined
    /** Whether the floating toggle button should be shown at all (e.g. only while the stream is live). */
    active: boolean
}>(function ScreenKeyboard({ getInput, active }, ref) {
    const mountRef = useRef<HTMLDivElement>(null)
    const engineRef = useRef<EngineScreenKeyboard | null>(null)
    const [open, setOpen] = useState(false)
    const [dim, setDim] = useState(false)
    const wakeTimerRef = useRef<number | null>(null)

    useEffect(() => {
        const keyboard = new EngineScreenKeyboard()
        engineRef.current = keyboard

        // Mirrors the engine's own `.hiddeninput` rule (web/styles/*.css),
        // which this UI doesn't import: keep the fake input alive so it can
        // hold OS keyboard focus, but push it off-screen and out of the way.
        const hidden = keyboard.getHiddenElement()
        Object.assign(hidden.style, {
            position: "fixed",
            top: "0",
            left: "0",
            zIndex: "-1000",
            resize: "none",
            translate: "200vw 200vh",
        })
        mountRef.current?.appendChild(hidden)

        const onKeyDown = (event: KeyboardEvent) => getInput()?.onKeyDown(event)
        const onKeyUp = (event: KeyboardEvent) => getInput()?.onKeyUp(event)
        const onText = (event: TextEvent) => getInput()?.sendText(event.detail.text)
        const onModeChange = (event: KeyboardModeEvent) => setOpen(event.detail.enabled)

        keyboard.addKeyDownListener(onKeyDown)
        keyboard.addKeyUpListener(onKeyUp)
        keyboard.addTextListener(onText)
        keyboard.addKeyboardModeListener(onModeChange)

        return () => {
            keyboard.hide()
            hidden.remove()
            engineRef.current = null
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useImperativeHandle(ref, () => ({
        show: () => engineRef.current?.show(),
        hide: () => engineRef.current?.hide(),
        isVisible: () => engineRef.current?.isVisible() ?? false,
    }), [])

    const wake = () => {
        setDim(false)
        if (wakeTimerRef.current != null) {
            window.clearTimeout(wakeTimerRef.current)
        }
        wakeTimerRef.current = window.setTimeout(() => setDim(true), WAKE_MS)
    }
    useEffect(() => {
        wake()
        return () => {
            if (wakeTimerRef.current != null) {
                window.clearTimeout(wakeTimerRef.current)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active])

    const toggle = () => {
        wake()
        if (engineRef.current?.isVisible()) {
            engineRef.current.hide()
        } else {
            engineRef.current?.show()
        }
    }

    return (
        <>
            <div ref={mountRef} />
            {active && (
                <button type="button" onClick={toggle} onPointerEnter={wake} onFocus={wake} onTouchStart={wake}
                    aria-label={open ? "Hide on-screen keyboard" : "Show on-screen keyboard"}
                    aria-pressed={open}
                    className={`fixed bottom-5 right-5 z-30 flex h-11 w-11 items-center justify-center
                        rounded-full border backdrop-blur-md transition-all duration-500 ease-out
                        focus-ring
                        ${open
                            ? "border-moon/60 bg-moon/20 text-moon opacity-100 shadow-[0_0_18px_rgba(122,162,255,0.35)]"
                            : `border-line bg-panel/85 text-fog hover:opacity-100 hover:text-snow ${dim ? "opacity-35" : "opacity-90"}`}`}>
                    <KeyboardIcon />
                </button>
            )}
        </>
    )
})

function KeyboardIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2.5" y="6" width="19" height="12" rx="2" />
            <path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M6 14h11" />
        </svg>
    )
}
