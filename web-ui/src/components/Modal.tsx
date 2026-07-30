import { ReactNode, useEffect, useRef } from "react"

/**
 * Dialog shell: dimmed backdrop, centered panel, Escape / backdrop-click to
 * dismiss (unless locked), and focus pulled inside on open.
 */
export function Modal({
    onClose,
    children,
    width = "w-[26rem]",
    dismissable = true,
    labelledBy,
}: {
    onClose: () => void
    children: ReactNode
    width?: string
    /** When false, Escape and backdrop clicks are ignored (flow in progress). */
    dismissable?: boolean
    labelledBy?: string
}) {
    const panelRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function onKey(event: KeyboardEvent) {
            if (event.key === "Escape" && dismissable) {
                event.stopPropagation()
                onClose()
            }
        }
        document.addEventListener("keydown", onKey)
        return () => document.removeEventListener("keydown", onKey)
    }, [dismissable, onClose])

    useEffect(() => {
        // Focus the first focusable element, falling back to the panel.
        const panel = panelRef.current
        if (!panel) {
            return
        }
        const target = panel.querySelector<HTMLElement>(
            "[autofocus], input, select, textarea, button, [tabindex]:not([tabindex='-1'])",
        )
        ;(target ?? panel).focus()
    }, [])

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-abyss/70 backdrop-blur-sm"
            onMouseDown={event => {
                if (dismissable && event.target === event.currentTarget) {
                    onClose()
                }
            }}
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={labelledBy}
                tabIndex={-1}
                className={`${width} max-w-full max-h-[90vh] overflow-y-auto rounded-tile border border-line
                    bg-panel shadow-[0_24px_80px_rgba(0,0,0,0.6)] outline-none animate-modal-in`}
            >
                {children}
            </div>
        </div>
    )
}
