import { useCallback, useRef, useState } from "react"
import { IconAlert, IconCheck } from "./icons"

export type ToastAction = {
    label: string
    onClick: () => void
}

export type Toast = {
    id: number
    kind: "info" | "error" | "warning"
    message: string
    action?: ToastAction
}

/** Page-level toast state; render the returned list with <Toasts>. */
export function useToasts() {
    const [toasts, setToasts] = useState<Toast[]>([])
    const nextId = useRef(1)

    const remove = useCallback((id: number) => {
        setToasts(current => current.filter(toast => toast.id !== id))
    }, [])

    const push = useCallback(
        (message: string, kind: Toast["kind"] = "info", action?: ToastAction) => {
            const id = nextId.current++
            setToasts(current => [...current, { id, kind, message, action }])
            // Toasts with a follow-up action (e.g. "Retry") stay up longer.
            window.setTimeout(() => remove(id), action ? 8000 : 4500)
        },
        [remove],
    )

    return { toasts, push, remove }
}

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss?: (id: number) => void }) {
    return (
        <div
            aria-live="polite"
            className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex w-full max-w-md
                -translate-x-1/2 flex-col items-center gap-2 px-4"
        >
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className={`pointer-events-auto flex items-center gap-2.5 rounded-xl border px-4 py-2.5
                        text-sm shadow-lg backdrop-blur-sm animate-rise ${
                            toast.kind === "error"
                                ? "border-red-400/40 bg-red-950/80 text-red-200"
                                : toast.kind === "warning"
                                  ? "border-ember/40 bg-panel-2/95 text-ember"
                                  : "border-line bg-panel-2/90 text-snow"
                        }`}
                >
                    {toast.kind === "error" ? (
                        <IconAlert size={16} className="shrink-0 text-red-300" />
                    ) : toast.kind === "warning" ? (
                        <IconAlert size={16} className="shrink-0 text-ember" />
                    ) : (
                        <IconCheck size={16} className="shrink-0 text-moon" />
                    )}
                    <span className={toast.kind === "warning" ? "text-snow" : ""}>{toast.message}</span>
                    {toast.action && (
                        <button
                            onClick={() => {
                                toast.action!.onClick()
                                onDismiss?.(toast.id)
                            }}
                            className={`focus-ring ml-auto shrink-0 rounded-lg border px-2.5 py-1 text-xs
                                font-medium whitespace-nowrap transition ${
                                    toast.kind === "error"
                                        ? "border-red-400/40 hover:bg-red-400/10"
                                        : toast.kind === "warning"
                                          ? "border-ember/40 hover:bg-ember/10"
                                          : "border-moon/40 hover:bg-moon/10"
                                }`}
                        >
                            {toast.action.label}
                        </button>
                    )}
                </div>
            ))}
        </div>
    )
}
