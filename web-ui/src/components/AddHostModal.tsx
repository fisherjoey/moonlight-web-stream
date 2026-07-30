import { useState } from "react"
import { Api, apiPostHost, DetailedHost, FetchError } from "../lib/api"
import { Modal } from "./Modal"
import { MoonSpinner } from "./Spinner"

/** Small form for `POST /host`: address plus optional HTTP port. */
export function AddHostModal({
    api,
    onClose,
    onAdded,
}: {
    api: Api
    onClose: () => void
    onAdded: (host: DetailedHost) => void
}) {
    const [address, setAddress] = useState("")
    const [port, setPort] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    async function submit(event: React.FormEvent) {
        event.preventDefault()
        const trimmed = address.trim()
        if (trimmed.length === 0) {
            setError("Enter the host's address.")
            return
        }
        let httpPort: number | null = null
        if (port.trim().length > 0) {
            httpPort = Number(port.trim())
            if (!Number.isInteger(httpPort) || httpPort < 1 || httpPort > 65535) {
                setError("Port must be a number between 1 and 65535.")
                return
            }
        }

        setBusy(true)
        setError(null)
        try {
            const host = await apiPostHost(api, { address: trimmed, http_port: httpPort })
            onAdded(host)
        } catch (e) {
            if (e instanceof FetchError && e.getResponse()?.status === 404) {
                setError(
                    `No Sunshine host answered at ${trimmed}. Check the address and make sure Sunshine is running.`,
                )
            } else {
                setError("Couldn't add the host. Check the address and try again.")
            }
        } finally {
            setBusy(false)
        }
    }

    return (
        <Modal onClose={onClose} dismissable={!busy} labelledBy="add-host-title">
            <form onSubmit={submit} className="flex flex-col gap-4 p-6">
                <h2 id="add-host-title" className="text-lg font-semibold tracking-tight">
                    Add a host
                </h2>
                <p className="-mt-2 text-sm text-fog">
                    The machine running Sunshine, by IP or hostname.
                </p>

                <label className="flex flex-col gap-1.5 text-sm">
                    <span className="text-fog">Address</span>
                    <input
                        autoFocus
                        value={address}
                        onChange={event => setAddress(event.target.value)}
                        placeholder="192.168.1.20"
                        autoComplete="off"
                        spellCheck={false}
                        className="focus-ring rounded-lg border border-line bg-panel-2 px-3 py-2
                            text-snow placeholder:text-fog/50"
                    />
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                    <span className="text-fog">
                        HTTP port <span className="text-fog/60">(optional, default 47989)</span>
                    </span>
                    <input
                        value={port}
                        onChange={event => setPort(event.target.value)}
                        placeholder="47989"
                        inputMode="numeric"
                        autoComplete="off"
                        className="focus-ring rounded-lg border border-line bg-panel-2 px-3 py-2
                            text-snow placeholder:text-fog/50"
                    />
                </label>

                {error && (
                    <p role="alert" className="rounded-lg border border-red-400/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                        {error}
                    </p>
                )}

                <div className="mt-2 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        className="focus-ring rounded-lg border border-line px-4 py-2 text-sm text-fog
                            transition hover:border-fog hover:text-snow disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={busy}
                        className="focus-ring flex items-center gap-2 rounded-lg bg-moon px-4 py-2 text-sm
                            font-medium text-abyss transition hover:bg-moon/85 disabled:opacity-50"
                    >
                        {busy && <MoonSpinner size={15} />}
                        {busy ? "Reaching out…" : "Add host"}
                    </button>
                </div>
            </form>
        </Modal>
    )
}
