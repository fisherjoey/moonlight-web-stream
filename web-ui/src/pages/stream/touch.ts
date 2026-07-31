import type { StreamInput } from "@engine/stream/input"

export type TouchInputCallbacks = {
    /** Lazily resolves the live StreamInput (mirrors the `input()` helper next to this call in main.tsx). */
    getInput: () => StreamInput | undefined
    /** The container's DOMRect, recomputed per call (mirrors the `rect()` helper next to this call). */
    getRect: () => DOMRect
    /** Same gate mouse events already use: `!menuOpen && phase !== "ended"`. */
    canForward: () => boolean
    isMenuOpen: () => boolean
    closeMenu: () => void
    /** Whether the on-screen keyboard's hidden input currently owns OS keyboard focus. */
    isKeyboardVisible: () => boolean
    /** Unlocks video/audio autoplay on first interaction, same as onMouseDown does. */
    onUserInteraction: () => void
    focusContainer: () => void
}

/**
 * Wires touch forwarding onto the video container, mirroring the old UI's
 * ViewerApp touch handlers (web/stream.ts onTouchStart/onTouchMove/onTouchEnd/
 * onTouchCancel/onTouchUpdate). The engine's StreamInput (web/stream/input.ts)
 * already implements all the gesture prediction — drag, two-finger scroll,
 * the three-finger screen-keyboard gesture, single-finger long-press right
 * click — from the raw touch stream. This function only plumbs events to it
 * faithfully; it makes no gesture decisions of its own.
 */
export function attachTouchInput(container: HTMLElement, callbacks: TouchInputCallbacks): () => void {
    const { getInput, getRect, canForward, isMenuOpen, closeMenu, isKeyboardVisible, onUserInteraction, focusContainer } = callbacks

    const onTouchStart = (event: TouchEvent) => {
        event.preventDefault()

        if (isMenuOpen()) {
            // Touching the video area while the menu is open dismisses it
            // without leaking the touch through, matching onMouseDown.
            closeMenu()
            return
        }
        if (!canForward()) {
            return
        }

        onUserInteraction()

        // Don't steal focus from the on-screen keyboard's hidden input while
        // it's up — refocusing the container would blur it and the OS
        // virtual keyboard would dismiss (mirrors ViewerApp.focusInput()).
        if (!isKeyboardVisible()) {
            focusContainer()
        }

        getInput()?.onTouchStart(event, getRect())
    }
    const onTouchMove = (event: TouchEvent) => {
        event.preventDefault()

        if (!canForward()) {
            return
        }

        getInput()?.onTouchMove(event, getRect())
    }
    const onTouchEnd = (event: TouchEvent) => {
        event.preventDefault()

        if (!canForward()) {
            return
        }

        getInput()?.onTouchEnd(event, getRect())
    }
    const onTouchCancel = (event: TouchEvent) => {
        event.preventDefault()

        // Always forwarded (even mid-menu / post-"ended") so no touch is left
        // stuck mid-gesture on the engine side, matching ViewerApp.onTouchCancel.
        getInput()?.onTouchCancel(event, getRect())
    }

    container.addEventListener("touchstart", onTouchStart, { passive: false })
    container.addEventListener("touchmove", onTouchMove, { passive: false })
    container.addEventListener("touchend", onTouchEnd, { passive: false })
    container.addEventListener("touchcancel", onTouchCancel, { passive: false })

    // The engine predicts drag/scroll/screen-keyboard gestures from a
    // continuously-updated read of touch position and elapsed time, not just
    // discrete events, so it needs this rAF loop running for the stream's
    // lifetime (see ViewerApp.onTouchUpdate). It's a no-op while no touch is
    // currently down.
    let raf = 0
    const update = () => {
        getInput()?.onTouchUpdate(getRect())
        raf = window.requestAnimationFrame(update)
    }
    raf = window.requestAnimationFrame(update)

    return () => {
        container.removeEventListener("touchstart", onTouchStart)
        container.removeEventListener("touchmove", onTouchMove)
        container.removeEventListener("touchend", onTouchEnd)
        container.removeEventListener("touchcancel", onTouchCancel)
        window.cancelAnimationFrame(raf)
    }
}
