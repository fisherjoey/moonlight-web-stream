import { useState } from "react"
import { Modal } from "./Modal"

export type ConfirmRequest = {
    title: string
    body: string
    confirmLabel: string
    danger?: boolean
    /** Runs on confirm; the dialog shows a busy state until it settles. */
    action: () => Promise<void>
}

export function ConfirmModal({ request, onClose }: { request: ConfirmRequest; onClose: () => void }) {
    const [busy, setBusy] = useState(false)

    async function confirm() {
        setBusy(true)
        try {
            await request.action()
        } finally {
            setBusy(false)
            onClose()
        }
    }

    return (
        <Modal onClose={onClose} dismissable={!busy} labelledBy="confirm-title">
            <div className="p-6">
                <h2 id="confirm-title" className="text-lg font-semibold tracking-tight">
                    {request.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-fog">{request.body}</p>
                <div className="mt-6 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={busy}
                        className="focus-ring rounded-lg border border-line px-4 py-2 text-sm text-fog
                            transition hover:border-fog hover:text-snow disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        autoFocus
                        onClick={confirm}
                        disabled={busy}
                        className={`focus-ring rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50
                            ${
                                request.danger
                                    ? "bg-red-400/15 text-red-300 border border-red-400/40 hover:bg-red-400/25"
                                    : "bg-moon text-abyss hover:bg-moon/85"
                            }`}
                    >
                        {busy ? "Working…" : request.confirmLabel}
                    </button>
                </div>
            </div>
        </Modal>
    )
}
