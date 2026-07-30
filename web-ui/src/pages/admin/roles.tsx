import { useEffect, useState } from "react"
import type {
    Api, DetailedRole, DetailedUser, RoleType, StreamPermissions, UndetailedRole,
} from "../../lib/api"
import {
    FetchError,
    apiDeleteRole,
    apiGetRole,
    apiPatchRole,
    apiPostRole,
} from "../../lib/api"
import {
    Badge, Banner, Button, ConfirmDialog, EmptyState, Field, Modal, SectionHeading, Switch,
    describeError, focusRing, inputClass,
} from "./ui"

function allowAllPermissions(): StreamPermissions {
    return {
        allow_add_hosts: true,
        maximum_bitrate_kbps: null,
        allow_codec_h264: true,
        allow_codec_h265: true,
        allow_codec_av1: true,
        allow_hdr: true,
        allow_transport_webrtc: true,
        allow_transport_websockets: true,
    }
}

export function RolesPanel({ api, self, users, roles, onRefresh }: {
    api: Api
    self: DetailedUser
    users: DetailedUser[]
    roles: UndetailedRole[]
    onRefresh: () => Promise<void>
}) {
    const [selectedId, setSelectedId] = useState<number | null>(null)
    const [search, setSearch] = useState("")
    const [createOpen, setCreateOpen] = useState(false)

    const needle = search.trim().toLowerCase()
    const filtered = needle === ""
        ? roles
        : roles.filter(role => role.name.toLowerCase().includes(needle))

    const memberCount = (roleId: number) =>
        users.filter(user => user.role_id === roleId).length

    return (
        <div className="grid gap-6 lg:grid-cols-[minmax(250px,330px)_1fr]">
            {/* Role list */}
            <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                    <input value={search} onChange={event => setSearch(event.target.value)}
                        type="search" placeholder="Search roles…" aria-label="Search roles"
                        className={inputClass} />
                    <Button variant="primary" onClick={() => setCreateOpen(true)}
                        className="shrink-0" aria-label="Create role">
                        + New
                    </Button>
                </div>
                <ul className="flex flex-col gap-1.5" aria-label="Roles">
                    {filtered.map(role => (
                        <li key={role.id}>
                            <button type="button" onClick={() => setSelectedId(role.id)}
                                aria-current={role.id === selectedId ? "true" : undefined}
                                className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5
                                    text-left transition ${focusRing}
                                    ${role.id === selectedId
                                        ? "border-moon/60 bg-panel-2 shadow-[0_0_18px_rgba(122,162,255,0.15)]"
                                        : "border-line bg-panel hover:border-moon/40"}`}>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium text-snow">{role.name}</span>
                                    <span className="block text-xs text-fog">
                                        <span className="font-mono text-fog/70">#{role.id}</span>
                                        {" · "}
                                        {memberCount(role.id)} {memberCount(role.id) === 1 ? "user" : "users"}
                                    </span>
                                </span>
                                {role.id === self.role_id && <Badge tone="moon">Yours</Badge>}
                            </button>
                        </li>
                    ))}
                    {filtered.length === 0 && (
                        <li className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-fog">
                            {roles.length === 0 ? "No roles yet." : "No roles match the search."}
                        </li>
                    )}
                </ul>
            </div>

            {/* Detail */}
            <div>
                {selectedId != null ? (
                    <RoleEditor key={selectedId} api={api} roleId={selectedId} users={users}
                        onChanged={onRefresh}
                        onDeleted={async () => {
                            setSelectedId(null)
                            await onRefresh()
                        }} />
                ) : (
                    <EmptyState title="Select a role"
                        body="Pick a role to edit its stream permissions and default settings, or create a new one." />
                )}
            </div>

            {createOpen && (
                <CreateRoleModal api={api}
                    onClose={() => setCreateOpen(false)}
                    onCreated={async (role) => {
                        setCreateOpen(false)
                        await onRefresh()
                        setSelectedId(role.id)
                    }} />
            )}
        </div>
    )
}

function RoleEditor({ api, roleId, users, onChanged, onDeleted }: {
    api: Api
    roleId: number
    users: DetailedUser[]
    onChanged: () => Promise<void>
    onDeleted: () => Promise<void>
}) {
    const [role, setRole] = useState<DetailedRole | null>(null)
    const [loadError, setLoadError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        apiGetRole(api, { id: roleId })
            .then(response => { if (!cancelled) setRole(response.role) })
            .catch(e => { if (!cancelled) setLoadError(describeError(e)) })
        return () => { cancelled = true }
    }, [api, roleId])

    if (loadError) {
        return <Banner tone="error">Couldn’t load the role: {loadError}</Banner>
    }
    if (role == null) {
        return <div className="p-6 text-sm text-fog">Loading role…</div>
    }
    return <RoleForm api={api} role={role} users={users} onChanged={onChanged} onDeleted={onDeleted} />
}

function RoleForm({ api, role, users, onChanged, onDeleted }: {
    api: Api
    role: DetailedRole
    users: DetailedUser[]
    onChanged: () => Promise<void>
    onDeleted: () => Promise<void>
}) {
    const [name, setName] = useState(role.name)
    const [displayName, setDisplayName] = useState(role.name)
    const [ty, setTy] = useState<RoleType>(role.ty)
    const [permissions, setPermissions] = useState<StreamPermissions>({ ...role.permissions })
    const [defaults, setDefaults] = useState<Record<string, any>>({ ...(role.default_settings ?? {}) })

    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [saved, setSaved] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)

    const members = users.filter(user => user.role_id === role.id)

    function setPermission<K extends keyof StreamPermissions>(key: K, value: StreamPermissions[K]) {
        setPermissions(previous => ({ ...previous, [key]: value }))
    }

    async function save(event: React.FormEvent) {
        event.preventDefault()
        setError(null)
        setSaved(false)
        if (name.trim() === "") {
            setError("The role needs a name.")
            return
        }
        setBusy(true)
        try {
            await apiPatchRole(api, {
                id: role.id,
                name: name.trim(),
                ty,
                permissions,
                default_settings: defaults,
            })
            setDisplayName(name.trim())
            setSaved(true)
            await onChanged()
        } catch (e) {
            setError(describeError(e))
        } finally {
            setBusy(false)
        }
    }

    function requestDelete() {
        setError(null)
        setSaved(false)
        // Same guard as the old admin: a role that still has members can't go.
        if (members.length > 0) {
            setError(`Can’t delete “${displayName}” — it’s still assigned to `
                + `${members.map(user => user.name).join(", ")}. Move ${members.length === 1 ? "that user" : "those users"} to another role first.`)
            return
        }
        setConfirmDelete(true)
    }

    async function remove() {
        setBusy(true)
        setError(null)
        try {
            await apiDeleteRole(api, { id: role.id })
            setConfirmDelete(false)
            await onDeleted()
        } catch (e) {
            setConfirmDelete(false)
            if (e instanceof FetchError && e.getResponse() != null) {
                setError(`The server refused to delete this role (${e.getResponse()!.status}). `
                    + "It may still be referenced — move any remaining users off it and try again.")
            } else {
                setError(describeError(e))
            }
        } finally {
            setBusy(false)
        }
    }

    return (
        <form onSubmit={save}
            className="flex flex-col gap-5 rounded-2xl border border-line bg-panel p-6">
            <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-semibold tracking-tight text-snow">{displayName}</h2>
                <span className="font-mono text-xs text-fog">#{role.id}</span>
                {role.ty === "Admin" && <Badge tone="moon2">Admin</Badge>}
                <Badge>{members.length} {members.length === 1 ? "user" : "users"}</Badge>
            </div>

            {error && <Banner tone="error">{error}</Banner>}
            {saved && <Banner tone="success">Saved.</Banner>}

            <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Name" htmlFor="role-name">
                    <input id="role-name" value={name} required
                        onChange={event => setName(event.target.value)}
                        className={inputClass} />
                </Field>
                <Field label="Type" htmlFor="role-type"
                    hint="Admin roles can open this panel and manage users.">
                    <select id="role-type" value={ty}
                        onChange={event => setTy(event.target.value as RoleType)}
                        className={inputClass}>
                        <option value="User">User</option>
                        <option value="Admin">Admin</option>
                    </select>
                </Field>
            </div>

            <SectionHeading>Stream permissions</SectionHeading>
            <div className="grid gap-2.5 sm:grid-cols-2">
                <Switch label="Add own hosts" checked={permissions.allow_add_hosts}
                    onChange={value => setPermission("allow_add_hosts", value)} />
                <Switch label="HDR streaming" checked={permissions.allow_hdr}
                    onChange={value => setPermission("allow_hdr", value)} />
                <Switch label="Codec · H.264" checked={permissions.allow_codec_h264}
                    onChange={value => setPermission("allow_codec_h264", value)} />
                <Switch label="Codec · H.265" checked={permissions.allow_codec_h265}
                    onChange={value => setPermission("allow_codec_h265", value)} />
                <Switch label="Codec · AV1" checked={permissions.allow_codec_av1}
                    onChange={value => setPermission("allow_codec_av1", value)} />
                <Switch label="Transport · WebRTC" checked={permissions.allow_transport_webrtc}
                    onChange={value => setPermission("allow_transport_webrtc", value)} />
                <Switch label="Transport · WebSockets" checked={permissions.allow_transport_websockets}
                    onChange={value => setPermission("allow_transport_websockets", value)} />
                <div className="flex flex-col gap-2.5">
                    <Switch label="Cap bitrate" checked={permissions.maximum_bitrate_kbps != null}
                        onChange={value => setPermission("maximum_bitrate_kbps", value ? 10000 : null)} />
                    {permissions.maximum_bitrate_kbps != null && (
                        <Field label="Maximum bitrate (kbps)" htmlFor="role-max-bitrate">
                            <input id="role-max-bitrate" type="number" min={500} step={100}
                                value={permissions.maximum_bitrate_kbps}
                                onChange={event => setPermission("maximum_bitrate_kbps",
                                    parseInt(event.target.value) || 0)}
                                className={`${inputClass} font-mono`} />
                        </Field>
                    )}
                </div>
            </div>

            <SectionHeading>Default stream settings</SectionHeading>
            <p className="-mt-2 text-xs text-fog">
                Starting values for users with this role. Empty fields inherit the global defaults.
            </p>
            <DefaultSettingsEditor defaults={defaults} onChange={setDefaults} />

            <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
                <Button variant="danger" onClick={requestDelete} disabled={busy}>
                    Delete role
                </Button>
                <Button variant="primary" type="submit" disabled={busy}>
                    {busy ? "Saving…" : "Save changes"}
                </Button>
            </div>

            {confirmDelete && (
                <ConfirmDialog title={`Delete ${displayName}?`}
                    confirmLabel="Delete role" busy={busy}
                    body={<p>No users hold this role. Deleting it is permanent.</p>}
                    onConfirm={remove}
                    onCancel={() => setConfirmDelete(false)} />
            )}
        </form>
    )
}

/**
 * Edits the role's default_settings blob. Quick fields cover the settings
 * admins actually tune per role; everything else in the blob is preserved
 * untouched and reachable through the raw JSON view.
 */
function DefaultSettingsEditor({ defaults, onChange }: {
    defaults: Record<string, any>
    onChange: (next: Record<string, any>) => void
}) {
    function set(key: string, value: any) {
        const next = { ...defaults }
        if (value === undefined) {
            delete next[key]
        } else {
            next[key] = value
        }
        onChange(next)
    }

    function setNumber(key: string, raw: string) {
        const parsed = parseInt(raw)
        set(key, raw === "" || isNaN(parsed) ? undefined : parsed)
    }

    const videoSize: string = defaults.videoSize ?? ""

    return (
        <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Bitrate (kbps)" htmlFor="def-bitrate">
                    <input id="def-bitrate" type="number" min={500} step={100}
                        value={defaults.bitrate ?? ""} placeholder="10000"
                        onChange={event => setNumber("bitrate", event.target.value)}
                        className={`${inputClass} font-mono`} />
                </Field>
                <Field label="FPS" htmlFor="def-fps">
                    <input id="def-fps" type="number" min={10} max={240}
                        value={defaults.fps ?? ""} placeholder="60"
                        onChange={event => setNumber("fps", event.target.value)}
                        className={`${inputClass} font-mono`} />
                </Field>
                <Field label="Resolution" htmlFor="def-video-size">
                    <select id="def-video-size" value={videoSize}
                        onChange={event => set("videoSize", event.target.value === "" ? undefined : event.target.value)}
                        className={inputClass}>
                        <option value="">Inherit</option>
                        <option value="720p">720p</option>
                        <option value="1080p">1080p</option>
                        <option value="1440p">1440p</option>
                        <option value="4k">4K</option>
                        <option value="native">Native</option>
                        <option value="custom">Custom</option>
                    </select>
                </Field>
                {videoSize === "custom" && (
                    <>
                        <Field label="Custom width" htmlFor="def-width">
                            <input id="def-width" type="number" min={1}
                                value={defaults.videoSizeCustom?.width ?? ""} placeholder="1920"
                                onChange={event => set("videoSizeCustom", {
                                    ...(defaults.videoSizeCustom ?? { height: 1080 }),
                                    width: parseInt(event.target.value) || 0,
                                })}
                                className={`${inputClass} font-mono`} />
                        </Field>
                        <Field label="Custom height" htmlFor="def-height">
                            <input id="def-height" type="number" min={1}
                                value={defaults.videoSizeCustom?.height ?? ""} placeholder="1080"
                                onChange={event => set("videoSizeCustom", {
                                    ...(defaults.videoSizeCustom ?? { width: 1920 }),
                                    height: parseInt(event.target.value) || 0,
                                })}
                                className={`${inputClass} font-mono`} />
                        </Field>
                    </>
                )}
                <Field label="Codec" htmlFor="def-codec">
                    <select id="def-codec" value={defaults.videoCodec ?? ""}
                        onChange={event => set("videoCodec", event.target.value === "" ? undefined : event.target.value)}
                        className={inputClass}>
                        <option value="">Inherit</option>
                        <option value="auto">Auto</option>
                        <option value="h264">H.264</option>
                        <option value="h265">H.265</option>
                        <option value="av1">AV1</option>
                    </select>
                </Field>
                <Field label="Transport" htmlFor="def-transport">
                    <select id="def-transport" value={defaults.dataTransport ?? ""}
                        onChange={event => set("dataTransport", event.target.value === "" ? undefined : event.target.value)}
                        className={inputClass}>
                        <option value="">Inherit</option>
                        <option value="auto">Auto</option>
                        <option value="webrtc">WebRTC</option>
                        <option value="websocket">WebSocket</option>
                    </select>
                </Field>
                <div className="sm:col-span-2 lg:col-span-1">
                    <Field label="HDR by default" htmlFor="def-hdr">
                        <Switch id="def-hdr" label={defaults.hdr ? "Enabled" : "Disabled"}
                            checked={!!defaults.hdr}
                            onChange={value => set("hdr", value)} />
                    </Field>
                </div>
            </div>

            <RawJsonEditor value={defaults} onApply={onChange} />
        </div>
    )
}

function RawJsonEditor({ value, onApply }: {
    value: Record<string, any>
    onApply: (next: Record<string, any>) => void
}) {
    const [text, setText] = useState(() => JSON.stringify(value, null, 2))
    const [dirty, setDirty] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Follow outside edits (quick fields) until the admin starts typing here.
    useEffect(() => {
        if (!dirty) {
            setText(JSON.stringify(value, null, 2))
        }
    }, [value, dirty])

    function apply() {
        try {
            const parsed = JSON.parse(text)
            if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
                setError("The default settings must be a JSON object.")
                return
            }
            setError(null)
            setDirty(false)
            onApply(parsed)
        } catch (e) {
            setError(`Not valid JSON: ${e instanceof Error ? e.message : e}`)
        }
    }

    return (
        <details className="group rounded-xl border border-line bg-panel-2/50">
            <summary className={`cursor-pointer select-none rounded-xl px-4 py-2.5 text-sm text-fog
                transition hover:text-snow ${focusRing}`}>
                Raw JSON
                <span className="ml-2 text-xs text-fog/70">every stored default, including keys not shown above</span>
            </summary>
            <div className="flex flex-col gap-3 px-4 pb-4">
                <textarea value={text} rows={10} spellCheck={false}
                    aria-label="Default settings JSON"
                    onChange={event => {
                        setText(event.target.value)
                        setDirty(true)
                    }}
                    className={`${inputClass} min-h-40 resize-y font-mono text-xs leading-relaxed`} />
                {error && <Banner tone="error">{error}</Banner>}
                <div className="flex items-center justify-end gap-3">
                    {dirty && <span className="text-xs text-fog">Unapplied edits</span>}
                    <Button variant="ghost" onClick={apply} disabled={!dirty}>
                        Apply JSON
                    </Button>
                </div>
            </div>
        </details>
    )
}

function CreateRoleModal({ api, onClose, onCreated }: {
    api: Api
    onClose: () => void
    onCreated: (role: DetailedRole) => Promise<void>
}) {
    const [name, setName] = useState("")
    const [ty, setTy] = useState<RoleType>("User")
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function submit(event: React.FormEvent) {
        event.preventDefault()
        setError(null)
        setBusy(true)
        try {
            const response = await apiPostRole(api, {
                name,
                ty,
                // Everything allowed to start with; tighten in the editor.
                permissions: allowAllPermissions(),
                // Empty blob = inherit the global defaults.
                default_settings: {},
            })
            await onCreated(response.role)
        } catch (e) {
            if (e instanceof FetchError && e.getResponse()?.status === 409) {
                setError(`A role named “${name}” already exists.`)
            } else {
                setError(describeError(e))
            }
        } finally {
            setBusy(false)
        }
    }

    return (
        <Modal title="New role" onClose={onClose}>
            <form onSubmit={submit} className="flex flex-col gap-4">
                {error && <Banner tone="error">{error}</Banner>}
                <Field label="Name" htmlFor="new-role-name">
                    <input id="new-role-name" value={name} required
                        onChange={event => setName(event.target.value)}
                        autoComplete="off" className={inputClass} />
                </Field>
                <Field label="Type" htmlFor="new-role-type"
                    hint="Admin roles can open this panel and manage users.">
                    <select id="new-role-type" value={ty}
                        onChange={event => setTy(event.target.value as RoleType)}
                        className={inputClass}>
                        <option value="User">User</option>
                        <option value="Admin">Admin</option>
                    </select>
                </Field>
                <p className="text-xs text-fog">
                    New roles start with every permission allowed and inherit the global stream
                    defaults — tune both in the editor after creating.
                </p>
                <div className="mt-1 flex justify-end gap-3">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" type="submit" disabled={busy}>
                        {busy ? "Creating…" : "Create role"}
                    </Button>
                </div>
            </form>
        </Modal>
    )
}
