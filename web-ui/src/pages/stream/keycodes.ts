import { StreamKeyModifiers, StreamKeys } from "@engine/api_bindings"
import type { StreamInput } from "@engine/stream/input"

/**
 * "Send Keycode" combos for the overlay menu.
 *
 * The old UI's sidebar (web/stream.ts ViewerSidebar + SendKeycodeModal) only
 * ever sent a single VK via `StreamInput.sendKey(down, key, modifiers)` with
 * modifiers hardcoded to 0 (see i18n key `selectKeycode` / `StreamKeys` in
 * api_bindings.ts) — there is no built-in "combo" helper in the engine.
 * `sendKeyCombo` below extends that same primitive to synthesize a whole
 * chord (e.g. Ctrl+Alt+Del) as the sequence of raw VK down/up events a real
 * keyboard would produce, so host-side apps see the modifiers actually held
 * down instead of just a raw keycode with modifiers=0.
 */

const MODIFIER_MASK_BY_KEY: Record<number, number> = {
    [StreamKeys.VK_LCONTROL]: StreamKeyModifiers.MASK_CTRL,
    [StreamKeys.VK_RCONTROL]: StreamKeyModifiers.MASK_CTRL,
    [StreamKeys.VK_LMENU]: StreamKeyModifiers.MASK_ALT,
    [StreamKeys.VK_RMENU]: StreamKeyModifiers.MASK_ALT,
    [StreamKeys.VK_LSHIFT]: StreamKeyModifiers.MASK_SHIFT,
    [StreamKeys.VK_RSHIFT]: StreamKeyModifiers.MASK_SHIFT,
    [StreamKeys.VK_LWIN]: StreamKeyModifiers.MASK_META,
    [StreamKeys.VK_RWIN]: StreamKeyModifiers.MASK_META,
}

export type KeycodeCombo = {
    id: string
    label: string
    /** VK codes in press order; every key but the last is treated as a held modifier. */
    keys: number[]
}

/** Mirrors the common combos native Moonlight clients expose for host-side system shortcuts. */
export const KEYCODE_COMBOS: KeycodeCombo[] = [
    { id: "ctrlAltDel", label: "Ctrl+Alt+Del", keys: [StreamKeys.VK_LCONTROL, StreamKeys.VK_LMENU, StreamKeys.VK_DELETE] },
    { id: "altTab", label: "Alt+Tab", keys: [StreamKeys.VK_LMENU, StreamKeys.VK_TAB] },
    { id: "altF4", label: "Alt+F4", keys: [StreamKeys.VK_LMENU, StreamKeys.VK_F4] },
    { id: "win", label: "Win", keys: [StreamKeys.VK_LWIN] },
    { id: "printScreen", label: "Print Screen", keys: [StreamKeys.VK_SNAPSHOT] },
    { id: "esc", label: "Esc", keys: [StreamKeys.VK_ESCAPE] },
]

/**
 * Sends a combo as the raw VK down/up sequence a physical keypress would
 * generate: leading "modifier" keys go down first (each carrying the
 * accumulated modifier bitmask, exactly like `StreamInput.sendKeyEvent`
 * computes for real KeyboardEvents), the final key is tapped down+up while
 * all modifiers are held, then the modifiers release in reverse order.
 */
export function sendKeyCombo(input: StreamInput, keys: number[]) {
    if (keys.length === 0) {
        return
    }
    const heldKeys = keys.slice(0, -1)
    const mainKey = keys[keys.length - 1]

    let modifiers = 0
    for (const key of heldKeys) {
        modifiers |= MODIFIER_MASK_BY_KEY[key] ?? 0
        input.sendKey(true, key, modifiers)
    }

    input.sendKey(true, mainKey, modifiers)
    input.sendKey(false, mainKey, modifiers)

    for (let i = heldKeys.length - 1; i >= 0; i--) {
        const key = heldKeys[i]
        modifiers &= ~(MODIFIER_MASK_BY_KEY[key] ?? 0)
        input.sendKey(false, key, modifiers)
    }
}
