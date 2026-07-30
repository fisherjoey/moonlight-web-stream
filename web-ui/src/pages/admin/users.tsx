import { useMemo, useState } from "react"
import type { Api, DetailedUser, UndetailedRole } from "../../lib/api"
import {
    FetchError,
    apiDeleteUser,
    apiPatchUser,
    apiPostUser,
} from "../../lib/api"
import {
    Badge, Banner, Button, ConfirmDialog, EmptyState, Field, Modal, Switch,
    describeError, focusRing, inputClass,
} from "./ui"

export function UsersPanel({ api, self, users, roles, onRefresh }: {
    api: Api
    /** The signed-in admin (badged, and warned before self-delete). */
    self: DetailedUser
    users: DetailedUser[]
    roles: UndetailedRole[]
    onRefresh: () => Promise<void>
}) {
    const [selectedId, setSelectedId] = useState<number | null>(null)
    const [search, setSearch] = useState("")
    const [createOpen, setCreateOpen] = useState(false)

    const roleNames = useMemo(() => {
        const map = new Map<number, string>()
        for (const role of roles) {
            map.set(role.id, role.name)
        }
        return map
    }, [roles])

    const filtered = useMemo(() => {
        const needle = search.trim().toLowerCase()
        if (needle === "") {
            return users
        }
        return users.filter(user => user.name.toLowerCase().includes(needle))
    }, [users, search])

    const selected = users.find(user => user.id === selectedId) ?? null

    return (
        <div className="grid gap-6 lg:grid-cols-[minmax(250px,330px)_1fr]">
            {/* Roster */}
            <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                    <input value={search} onChange={event => setSearch(event.target.value)}
                        type="search" placeholder="Search users…" aria-label="Search users"
                        className={inputClass} />
                    <Button variant="primary" onClick={() => setCreateOpen(true)}
                        className="shrink-0" aria-label="Create user">
                        + New
                    </Button>
                </div>
                <ul className="flex flex-col gap-1.5" aria-label="Users">
                    {filtered.map(user => (
                        <li key={user.id}>
                            <button type="button" onClick={() => setSelectedId(user.id)}
                                aria-current={user.id === selectedId ? "true" : undefined}
                                className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5
                                    text-left transition ${focusRing}
                                    ${user.id === selectedId
                                        ? "border-moon/60 bg-panel-2 shadow-[0_0_18px_rgba(122,162,255,0.15)]"
                                        : "border-line bg-panel hover:border-moon/40"}`}>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium text-snow">{user.name}</span>
                                    <span className="block truncate text-xs text-fog">
                                        {roleNames.get(user.role_id) ?? "unknown role"}
                                        <span className="font-mono text-fog/70"> · #{user.id}</span>
                                    </span>
                                </span>
                                {user.role === "Admin" && <Badge tone="moon2">Admin</Badge>}
                                {user.is_default_user && <Badge>Default</Badge>}
                                {user.id === self.id && <Badge tone="moon">You</Badge>}
                            </button>
                        </li>
                    ))}
                    {filtered.length === 0 && (
                        <li className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-fog">
                            {users.length === 0 ? "No users yet." : "No users match the search."}
                        </li>
                    )}
                </ul>
            </div>

            {/* Detail */}
            <div>
                {selected ? (
                    <UserEditor key={selected.id} api={api} user={selected} self={self} roles={roles}
                        onChanged={onRefresh}
                        onDeleted={async () => {
                            setSelectedId(null)
                            await onRefresh()
                        }} />
                ) : (
                    <EmptyState title="Select a user"
                        body="Pick a user from the roster to change their password, role or Moonlight client id." />
                )}
            </div>

            {createOpen && (
                <CreateUserModal api={api} roles={roles}
                    onClose={() => setCreateOpen(false)}
                    onCreated={async (user) => {
                        setCreateOpen(false)
                        await onRefresh()
                        setSelectedId(user.id)
                    }} />
            )}
        </div>
    )
}

function UserEditor({ api, user, self, roles, onChanged, onDeleted }: {
    api: Api
    user: DetailedUser
    self: DetailedUser
    roles: UndetailedRole[]
    onChanged: () => Promise<void>
    onDeleted: () => Promise<void>
}) {
    const [changePassword, setChangePassword] = useState(false)
    const [password, setPassword] = useState("")
    const [roleId, setRoleId] = useState(user.role_id)
    const [clientUniqueId, setClientUniqueId] = useState(user.client_unique_id)

    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [saved, setSaved] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)

    async function save(event: React.FormEvent) {
        event.preventDefault()
        setError(null)
        setSaved(false)
        if (changePassword && password === "") {
            setError("Enter the new password, or turn \"Set a new password\" off.")
            return
        }
        setBusy(true)
        try {
            await apiPatchUser(api, {
                id: user.id,
                password: changePassword ? password : null,
                role_id: roleId,
                client_unique_id: clientUniqueId,
            })
            setChangePassword(false)
            setPassword("")
            setSaved(true)
            await onChanged()
        } catch (e) {
            setError(describeError(e))
        } finally {
            setBusy(false)
        }
    }

    async function remove() {
        setBusy(true)
        setError(null)
        try {
            await apiDeleteUser(api, { id: user.id })
            setConfirmDelete(false)
            await onDeleted()
        } catch (e) {
            setConfirmDelete(false)
            setError(describeError(e))
        } finally {
            setBusy(false)
        }
    }

    return (
        <form onSubmit={save}
            className="flex flex-col gap-5 rounded-2xl border border-line bg-panel p-6">
            <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-semibold tracking-tight text-snow">{user.name}</h2>
                <span className="font-mono text-xs text-fog">#{user.id}</span>
                {user.is_default_user && <Badge>Default user</Badge>}
                {user.id === self.id && <Badge tone="moon">You</Badge>}
            </div>

            {error && <Banner tone="error">{error}</Banner>}
            {saved && <Banner tone="success">Saved.</Banner>}

            <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Role" htmlFor="user-role">
                    <select id="user-role" value={roleId}
                        onChange={event => setRoleId(parseInt(event.target.value))}
                        className={inputClass}>
                        {roles.map(role => (
                            <option key={role.id} value={role.id}>{role.name} ({role.id})</option>
                        ))}
                    </select>
                </Field>
                <Field label="Moonlight client id" htmlFor="user-client-id"
                    hint="Identifies this user to paired hosts.">
                    <input id="user-client-id" value={clientUniqueId}
                        onChange={event => setClientUniqueId(event.target.value)}
                        className={`${inputClass} font-mono`} />
                </Field>
            </div>

            <div className="flex flex-col gap-3">
                <Switch checked={changePassword} onChange={next => {
                    setChangePassword(next)
                    if (!next) setPassword("")
                }} label="Set a new password" />
                {changePassword && (
                    <Field label="New password" htmlFor="user-password"
                        hint="The current password is never shown.">
                        <input id="user-password" type="password" value={password}
                            onChange={event => setPassword(event.target.value)}
                            autoComplete="new-password" placeholder="New password"
                            className={inputClass} />
                    </Field>
                )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
                <Button variant="danger" onClick={() => setConfirmDelete(true)} disabled={busy}>
                    Delete user
                </Button>
                <Button variant="primary" type="submit" disabled={busy}>
                    {busy ? "Saving…" : "Save changes"}
                </Button>
            </div>

            {confirmDelete && (
                <ConfirmDialog title={`Delete ${user.name}?`}
                    confirmLabel="Delete user" busy={busy}
                    body={
                        <div className="flex flex-col gap-2">
                            <p>This permanently removes the account and its host pairings.</p>
                            {user.id === self.id && (
                                <p className="text-red-300">This is your own account — you will lose access.</p>
                            )}
                        </div>
                    }
                    onConfirm={remove}
                    onCancel={() => setConfirmDelete(false)} />
            )}
        </form>
    )
}

function CreateUserModal({ api, roles, onClose, onCreated }: {
    api: Api
    roles: UndetailedRole[]
    onClose: () => void
    onCreated: (user: DetailedUser) => Promise<void>
}) {
    const [name, setName] = useState("")
    const [password, setPassword] = useState("")
    const [roleId, setRoleId] = useState<number | null>(roles[0]?.id ?? null)
    const [clientUniqueId, setClientUniqueId] = useState("")
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function submit(event: React.FormEvent) {
        event.preventDefault()
        setError(null)
        if (roleId == null) {
            setError("Create a role first — every user needs one.")
            return
        }
        setBusy(true)
        try {
            const user = await apiPostUser(api, {
                name,
                password,
                role_id: roleId,
                // Same convention as the old admin: default the client id to the name.
                client_unique_id: clientUniqueId.trim() === "" ? name : clientUniqueId.trim(),
            })
            await onCreated(user)
        } catch (e) {
            if (e instanceof FetchError && e.getResponse()?.status === 409) {
                setError(`A user named “${name}” already exists.`)
            } else {
                setError(describeError(e))
            }
        } finally {
            setBusy(false)
        }
    }

    return (
        <Modal title="New user" onClose={onClose}>
            <form onSubmit={submit} className="flex flex-col gap-4">
                {error && <Banner tone="error">{error}</Banner>}
                <Field label="Name" htmlFor="new-user-name">
                    <input id="new-user-name" value={name} required
                        onChange={event => setName(event.target.value)}
                        autoComplete="off" className={inputClass} />
                </Field>
                <Field label="Password" htmlFor="new-user-password">
                    <input id="new-user-password" type="password" value={password} required
                        onChange={event => setPassword(event.target.value)}
                        autoComplete="new-password" className={inputClass} />
                </Field>
                <Field label="Role" htmlFor="new-user-role">
                    <select id="new-user-role" value={roleId ?? ""}
                        onChange={event => setRoleId(parseInt(event.target.value))}
                        className={inputClass}>
                        {roles.map(role => (
                            <option key={role.id} value={role.id}>{role.name} ({role.id})</option>
                        ))}
                    </select>
                </Field>
                <Field label="Moonlight client id" htmlFor="new-user-client-id"
                    hint="Optional — defaults to the name.">
                    <input id="new-user-client-id" value={clientUniqueId}
                        onChange={event => setClientUniqueId(event.target.value)}
                        placeholder={name || "same as name"}
                        className={`${inputClass} font-mono`} />
                </Field>
                <div className="mt-1 flex justify-end gap-3">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" type="submit" disabled={busy}>
                        {busy ? "Creating…" : "Create user"}
                    </Button>
                </div>
            </form>
        </Modal>
    )
}
