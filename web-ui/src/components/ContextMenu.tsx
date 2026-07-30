import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react"

export type MenuItem = {
    label: string
    icon?: ReactNode
    danger?: boolean
    onSelect: () => void
}

export type MenuState = {
    x: number
    y: number
    items: MenuItem[]
}

/**
 * Right-click / "more" menu: fixed-positioned at the invocation point,
 * clamped to the viewport, fully keyboard operable (arrows, Enter, Escape).
 */
export function ContextMenu({ menu, onClose }: { menu: MenuState; onClose: () => void }) {
    const ref = useRef<HTMLDivElement>(null)
    const [pos, setPos] = useState({ x: menu.x, y: menu.y })

    useLayoutEffect(() => {
        const el = ref.current
        if (!el) {
            return
        }
        const rect = el.getBoundingClientRect()
        setPos({
            x: Math.min(menu.x, window.innerWidth - rect.width - 8),
            y: Math.min(menu.y, window.innerHeight - rect.height - 8),
        })
        el.querySelector<HTMLElement>("button")?.focus()
    }, [menu])

    useEffect(() => {
        function onDown(event: MouseEvent) {
            if (!ref.current?.contains(event.target as Node)) {
                onClose()
            }
        }
        function onKey(event: KeyboardEvent) {
            if (event.key === "Escape") {
                event.stopPropagation()
                onClose()
                return
            }
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
                return
            }
            event.preventDefault()
            const buttons = [...(ref.current?.querySelectorAll<HTMLElement>("button") ?? [])]
            if (buttons.length === 0) {
                return
            }
            const index = buttons.indexOf(document.activeElement as HTMLElement)
            const delta = event.key === "ArrowDown" ? 1 : -1
            buttons[(index + delta + buttons.length) % buttons.length].focus()
        }
        document.addEventListener("mousedown", onDown)
        document.addEventListener("keydown", onKey)
        window.addEventListener("blur", onClose)
        return () => {
            document.removeEventListener("mousedown", onDown)
            document.removeEventListener("keydown", onKey)
            window.removeEventListener("blur", onClose)
        }
    }, [onClose])

    return (
        <div
            ref={ref}
            role="menu"
            style={{ left: pos.x, top: pos.y }}
            className="fixed z-50 min-w-52 rounded-xl border border-line bg-panel-2/95 p-1.5
                shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-sm animate-modal-in"
        >
            {menu.items.map(item => (
                <button
                    key={item.label}
                    role="menuitem"
                    onClick={() => {
                        onClose()
                        item.onSelect()
                    }}
                    className={`focus-ring flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm
                        transition ${
                            item.danger
                                ? "text-red-300 hover:bg-red-400/10"
                                : "text-snow hover:bg-moon/10"
                        }`}
                >
                    {item.icon && <span className="text-fog">{item.icon}</span>}
                    {item.label}
                </button>
            ))}
        </div>
    )
}
