import { ReactNode, useEffect, useRef } from "react"

/**
 * Shared primitives for the admin surface. Console-dark "operations deck"
 * flavor: same abyss/panel/moon token family as the launcher pages, with
 * monospace accents for machine-ish values (ids, client ids, JSON).
 */

export const focusRing =
    "outline-none focus-visible:ring-2 focus-visible:ring-moon/70 " +
    "focus-visible:ring-offset-2 focus-visible:ring-offset-abyss"

const buttonBase =
    `inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium ` +
    `transition disabled:opacity-45 disabled:pointer-events-none ${focusRing}`

const buttonVariants = {
    primary: "bg-moon/90 text-abyss hover:bg-moon hover:shadow-[0_0_20px_rgba(122,162,255,0.35)]",
    ghost: "border border-line bg-panel text-snow hover:border-moon/60 hover:text-snow",
    subtle: "text-fog hover:text-snow",
    danger: "border border-red-400/30 bg-red-400/10 text-red-300 hover:bg-red-400/20 hover:border-red-400/50",
} as const

export function Button({ variant = "ghost", type = "button", className = "", ...rest }: {
    variant?: keyof typeof buttonVariants
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button type={type}
            className={`${buttonBase} ${buttonVariants[variant]} ${className}`}
            {...rest} />
    )
}

export const inputClass =
    `w-full rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm text-snow ` +
    `placeholder:text-fog/60 transition outline-none focus:border-moon/70 ` +
    `focus-visible:ring-2 focus-visible:ring-moon/30 disabled:opacity-45`

export function Field({ label, htmlFor, hint, children }: {
    label: string
    htmlFor?: string
    hint?: string
    children: ReactNode
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={htmlFor} className="text-[11px] font-semibold uppercase tracking-[0.18em] text-fog">
                {label}
            </label>
            {children}
            {hint && <p className="text-xs text-fog/80">{hint}</p>}
        </div>
    )
}

export function SectionHeading({ children }: { children: ReactNode }) {
    return (
        <div className="flex items-center gap-3 pt-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-moon">{children}</h3>
            <div className="h-px flex-1 bg-line" />
        </div>
    )
}

export function Switch({ checked, onChange, label, id, disabled }: {
    checked: boolean
    onChange: (next: boolean) => void
    label: string
    id?: string
    disabled?: boolean
}) {
    return (
        <button type="button" role="switch" aria-checked={checked} id={id} disabled={disabled}
            onClick={() => onChange(!checked)}
            className={`group flex w-full items-center justify-between gap-4 rounded-lg border px-3 py-2 text-left
                text-sm transition disabled:opacity-45 ${focusRing}
                ${checked ? "border-moon/40 bg-moon/10" : "border-line bg-panel-2"}`}>
            <span className={checked ? "text-snow" : "text-fog"}>{label}</span>
            <span aria-hidden
                className={`relative h-5 w-9 shrink-0 rounded-full transition
                    ${checked ? "bg-moon shadow-[0_0_12px_rgba(122,162,255,0.5)]" : "bg-line"}`}>
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-abyss transition-all
                    ${checked ? "left-[18px]" : "left-0.5"}`} />
            </span>
        </button>
    )
}

export function Badge({ tone = "line", children }: {
    tone?: "line" | "moon" | "moon2" | "red"
    children: ReactNode
}) {
    const tones = {
        line: "border-line bg-panel-2 text-fog",
        moon: "border-moon/40 bg-moon/10 text-moon",
        moon2: "border-moon-2/40 bg-moon-2/10 text-moon-2",
        red: "border-red-400/40 bg-red-400/10 text-red-300",
    }
    return (
        <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px]
            font-semibold uppercase tracking-[0.14em] ${tones[tone]}`}>
            {children}
        </span>
    )
}

export function Banner({ tone, children }: { tone: "error" | "success", children: ReactNode }) {
    const styles = tone === "error"
        ? "border-red-400/40 bg-red-400/10 text-red-300"
        : "border-moon/40 bg-moon/10 text-moon"
    return (
        <div role={tone === "error" ? "alert" : "status"}
            className={`rounded-lg border px-3 py-2 text-sm ${styles}`}>
            {children}
        </div>
    )
}

export function Modal({ title, onClose, children, wide }: {
    title: string
    onClose: () => void
    children: ReactNode
    wide?: boolean
}) {
    const panelRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function onKey(event: KeyboardEvent) {
            if (event.key === "Escape") {
                onClose()
            }
        }
        window.addEventListener("keydown", onKey)
        // Move focus into the dialog so keyboard users land inside it.
        const first = panelRef.current?.querySelector<HTMLElement>(
            "input, select, textarea, button")
        first?.focus()
        return () => window.removeEventListener("keydown", onKey)
    }, [onClose])

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
            <div className="absolute inset-0 bg-abyss/75 backdrop-blur-sm" aria-hidden
                onMouseDown={onClose} />
            <div ref={panelRef} role="dialog" aria-modal="true" aria-label={title}
                className={`relative max-h-[85vh] w-full overflow-y-auto rounded-2xl border border-line
                    bg-panel p-6 shadow-[0_24px_80px_rgba(0,0,0,0.6)]
                    ${wide ? "max-w-xl" : "max-w-md"}`}>
                <div className="mb-5 flex items-start justify-between gap-4">
                    <h2 className="text-lg font-semibold tracking-tight text-snow">{title}</h2>
                    <button type="button" onClick={onClose} aria-label="Close dialog"
                        className={`rounded-md px-2 py-0.5 text-fog transition hover:text-snow ${focusRing}`}>
                        ✕
                    </button>
                </div>
                {children}
            </div>
        </div>
    )
}

export function ConfirmDialog({ title, body, confirmLabel, busy, onConfirm, onCancel }: {
    title: string
    body: ReactNode
    confirmLabel: string
    busy?: boolean
    onConfirm: () => void
    onCancel: () => void
}) {
    return (
        <Modal title={title} onClose={onCancel}>
            <div className="flex flex-col gap-5">
                <div className="text-sm text-fog">{body}</div>
                <div className="flex justify-end gap-3">
                    {/* Cancel first in DOM: it receives initial focus, so Enter is safe. */}
                    <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button variant="danger" onClick={onConfirm} disabled={busy}>
                        {busy ? "Working…" : confirmLabel}
                    </Button>
                </div>
            </div>
        </Modal>
    )
}

export function EmptyState({ title, body }: { title: string, body?: string }) {
    return (
        <div className="flex h-full min-h-48 flex-col items-center justify-center gap-1 rounded-2xl
            border border-dashed border-line p-8 text-center">
            <p className="text-sm font-medium text-snow">{title}</p>
            {body && <p className="max-w-sm text-sm text-fog">{body}</p>}
        </div>
    )
}

/// Human-readable message for engine FetchError / unknown throwables.
export function describeError(error: unknown): string {
    if (error instanceof Error) {
        return error.message
    }
    return String(error)
}
