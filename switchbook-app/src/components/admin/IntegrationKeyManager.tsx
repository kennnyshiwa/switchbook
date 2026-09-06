'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'

type Credential = { id: string; prefix: string; scopes: string[]; createdAt: string; expiresAt: string | null; revokedAt: string | null; lastUsedAt: string | null }
type AuditEvent = { id: string; actorUserId: string | null; action: string; resourceId: string | null; createdAt: string }
type Application = { id: string; name: string; clientId: string; active: boolean; scopes: string[]; rateLimitPerMinute: number; createdAt: string; updatedAt: string; credentials: Credential[]; auditEvents: AuditEvent[] }

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers }, cache: 'no-store' })
  const data = await response.json()
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Request failed')
  return data
}

const date = (value: string | null) => value ? new Date(value).toLocaleString() : 'Never'

export default function IntegrationKeyManager() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [revealed, setRevealed] = useState<{ apiKey: string; prefix: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const refresh = useCallback(async () => {
    try { setApplications((await api('/api/admin/integrations')).applications); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load integrations') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy('create'); setError('')
    const form = new FormData(event.currentTarget)
    try {
      const result = await api('/api/admin/integrations', { method: 'POST', body: JSON.stringify({ name: form.get('name'), rateLimitPerMinute: Number(form.get('rateLimit')), expiresAt: form.get('expiresAt') ? new Date(String(form.get('expiresAt'))).toISOString() : null }) })
      setRevealed({ apiKey: result.apiKey, prefix: result.credential.prefix }); setCopied(false); event.currentTarget.reset(); await refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to create integration') }
    finally { setBusy(null) }
  }

  async function rotate(application: Application) {
    const revokeExisting = window.confirm('Revoke all existing active keys when the new key is created?\n\nOK = revoke existing immediately. Cancel = keep an overlap window.')
    if (!window.confirm(`Create a replacement key for ${application.name} with ${revokeExisting ? 'immediate revocation' : 'overlap'}?`)) return
    setBusy(application.id); setError('')
    try {
      const result = await api(`/api/admin/integrations/${application.id}/rotate`, { method: 'POST', body: JSON.stringify({ revokeExisting, expiresAt: null }) })
      setRevealed({ apiKey: result.apiKey, prefix: result.credential.prefix }); setCopied(false); await refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to rotate key') }
    finally { setBusy(null) }
  }

  async function revoke(application: Application, credential: Credential) {
    if (!window.confirm(`Immediately revoke ${credential.prefix}? Requests using it will return 401.`)) return
    setBusy(credential.id); setError('')
    try { await api(`/api/admin/integrations/${application.id}/credentials/${credential.id}/revoke`, { method: 'POST', body: '{}' }); await refresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to revoke key') }
    finally { setBusy(null) }
  }

  async function copy() {
    if (!revealed) return
    try { await navigator.clipboard.writeText(revealed.apiKey); setCopied(true) }
    catch { setError('Copy failed. Select the key and copy it manually before closing.') }
  }

  return <div className="space-y-6">
    {revealed && <section role="alert" className="rounded-lg border-2 border-amber-500 bg-amber-50 p-4 text-gray-900 dark:bg-amber-950 dark:text-white">
      <h2 className="text-lg font-semibold">Copy this key now</h2>
      <p className="mt-1 text-sm">This is the only reveal. Closing or refreshing permanently hides it.</p>
      <label className="mt-3 block text-sm font-medium" htmlFor="one-time-api-key">API key ({revealed.prefix})</label>
      <div className="mt-1 flex flex-col gap-2 sm:flex-row">
        <input id="one-time-api-key" readOnly value={revealed.apiKey} className="min-w-0 flex-1 rounded border px-3 py-2 font-mono text-sm text-gray-950" onFocus={event => event.currentTarget.select()} />
        <button type="button" onClick={copy} className="rounded bg-gray-900 px-4 py-2 text-white focus-visible:ring-2">{copied ? 'Copied' : 'Copy key'}</button>
        <button type="button" onClick={() => { setRevealed(null); setCopied(false) }} className="rounded border px-4 py-2">I saved it</button>
      </div>
    </section>}

    <form onSubmit={create} className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
      <h2 className="text-lg font-semibold">Create catalog integration</h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Creates an application key with only <code>catalog:read</code>. OAuth, redirects, and webhooks are disabled.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-medium">Name<input required name="name" maxLength={120} className="mt-1 w-full rounded border px-3 py-2 text-gray-950" /></label>
        <label className="text-sm font-medium">Requests per minute<input required name="rateLimit" type="number" min={1} max={600} defaultValue={120} className="mt-1 w-full rounded border px-3 py-2 text-gray-950" /></label>
        <label className="text-sm font-medium">Expires (optional)<input name="expiresAt" type="datetime-local" className="mt-1 w-full rounded border px-3 py-2 text-gray-950" /></label>
      </div>
      <button disabled={busy !== null} className="mt-4 rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{busy === 'create' ? 'Creating…' : 'Create and reveal key'}</button>
    </form>

    {error && <p role="alert" className="rounded bg-red-100 p-3 text-red-900">{error}</p>}
    {loading ? <p role="status">Loading integrations…</p> : applications.length === 0 ? <p className="rounded border border-dashed p-6 text-center">No catalog integrations yet.</p> : applications.map(application => <section key={application.id} className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
      <header className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-700">
        <div><h2 className="text-lg font-semibold">{application.name}</h2><p className="font-mono text-xs text-gray-500">{application.clientId}</p></div>
        <div className="flex items-center gap-3"><span className="text-sm">catalog:read · {application.rateLimitPerMinute}/min</span><button disabled={busy !== null || !application.active} onClick={() => void rotate(application)} className="rounded border px-3 py-2 text-sm disabled:opacity-50">Rotate key</button></div>
      </header>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b dark:border-gray-700"><th className="p-3">Prefix</th><th className="p-3">Created</th><th className="p-3">Expires</th><th className="p-3">Last used</th><th className="p-3">Status</th><th className="p-3"><span className="sr-only">Actions</span></th></tr></thead>
      <tbody>{application.credentials.map(credential => <tr key={credential.id} className="border-b last:border-0 dark:border-gray-700"><td className="p-3 font-mono">{credential.prefix}</td><td className="p-3">{date(credential.createdAt)}</td><td className="p-3">{date(credential.expiresAt)}</td><td className="p-3">{date(credential.lastUsedAt)}</td><td className="p-3">{credential.revokedAt ? `Revoked ${date(credential.revokedAt)}` : 'Active'}</td><td className="p-3">{!credential.revokedAt && <button disabled={busy !== null} onClick={() => void revoke(application, credential)} className="rounded border border-red-500 px-3 py-1 text-red-700 disabled:opacity-50 dark:text-red-300">Revoke</button>}</td></tr>)}</tbody></table></div>
      <details className="border-t p-4 dark:border-gray-700"><summary className="cursor-pointer font-medium">Recent audit activity ({application.auditEvents.length})</summary><ul className="mt-3 space-y-2 text-sm">{application.auditEvents.map(event => <li key={event.id}><time>{date(event.createdAt)}</time> · {event.action} · actor {event.actorUserId || 'system'} · target {event.resourceId || 'application'}</li>)}</ul></details>
    </section>)}
  </div>
}
