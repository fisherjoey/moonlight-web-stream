import { useCallback, useRef, useState } from "react"
import { IconAlert, IconCheck } from "./icons"

export type Toast = {
    id: number
    kind: "info" | "error"
    message: string
}

/** Page-level toast state; render the returned list with <Toasts>. */
export function useToasts() {
    const [toasts, setToasts] = useState<Toast[]>([])
    const nextId = useRef(1)

    const push = useCallback((message: string, kind: Toast["kind"] = "info") => {
        const id = nextId.current++
        setToasts(current => [...current, { id, kind, message }])
        window.setTimeout(() => {
            setToasts(current => current.filter(toast => toast.id !== id))
        }, 4500)
    }, [])

    return { toasts, push }
}

export function Toasts({ toasts }: { toasts: Toast[] }) {
    return (
        <div
            aria-live="polite"
            className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex w-full max-w-md
                -translate-x-1/2 flex-col items-center gap-2 px-4"
        >
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className={`flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm shadow-lg
                        backdrop-blur-sm animate-rise ${
                            toast.kind === "error"
                                ? "border-red-400/40 bg-red-950/80 text-red-200"
                                : "border-line bg-panel-2/90 text-snow"
                        }`}
                >
                    {toast.kind === "error" ? (
                        <IconAlert size={16} className="shrink-0 text-red-300" />
                    ) : (
                        <IconCheck size={16} className="shrink-0 text-moon" />
                    )}
                    {toast.message}
                </div>
            ))}
        </div>
    )
}
