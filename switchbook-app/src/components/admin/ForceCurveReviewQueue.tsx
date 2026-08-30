'use client'

import { useEffect, useRef, useState } from 'react'

type Candidate = { id: string; displayName: string; repositoryPath: string; revision: string | null; contentHash: string | null; manufacturer: string | null; technology: string | null }
type Master = { id: string; name: string; manufacturer: string | null; technology: string | null; compatibility?: { compatible: boolean; reason: string } }
type Evidence = { id: string; kind: string; reason: string; status: 'OPEN' | 'RESOLVED'; catalogEntryId: string | null; masterSwitch: Master | null; candidates: Candidate[] }
type Item = { sourceKey: string; primaryReviewId: string; bucket: string; confidence: number; actionable: boolean; deferred: boolean; status: 'OPEN' | 'RESOLVED'; evidence: Evidence[] }
type Queue = { items: Item[]; counts: Record<string, number>; rawReviewCount: number; uniqueSourceCount: number; openSourceCount: number; resolvedSourceCount: number; remainingActionable: number; deferredCount: number; filteredSourceCount: number; pagination: { page: number; pageSize: number; pageCount: number; hasPrevious: boolean; hasNext: boolean } }

const controlClass = 'min-h-11 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400 dark:hover:border-gray-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/30'
const secondaryButtonClass = 'min-h-11 rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 dark:focus-visible:ring-offset-gray-800'

export default function ForceCurveReviewQueue({ initialQueue }: { initialQueue: Queue }) {
  const [queue, setQueue] = useState(initialQueue)
  const [query, setQuery] = useState('')
  const [bucket, setBucket] = useState('ALL')
  const [status, setStatus] = useState('OPEN')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [masterQuery, setMasterQuery] = useState<Record<string, string>>({})
  const [masterResults, setMasterResults] = useState<Record<string, Master[]>>({})
  const [chosenMaster, setChosenMaster] = useState<Record<string, string>>({})

  const initialLoad = useRef(true)

  async function refreshQueue(page = queue.pagination.page, signal?: AbortSignal) {
    const params = new URLSearchParams({ page: String(page), pageSize: String(queue.pagination.pageSize), query, bucket, status })
    const fresh = await fetch(`/api/admin/force-curves/reviews?${params}`, { signal })
    if (!fresh.ok) throw new Error('Saved, but refresh failed')
    setQueue(await fresh.json())
  }

  useEffect(() => {
    if (initialLoad.current) { initialLoad.current = false; return }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setBusy('queue-filter')
      setError('')
      refreshQueue(1, controller.signal).catch(error => {
        if (error instanceof Error && error.name !== 'AbortError') setError('Queue refresh failed')
      }).finally(() => setBusy(''))
    }, query ? 200 : 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  // Refresh only when server-side filters change; refreshQueue deliberately uses current state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, bucket, status])

  async function mutate(item: Item, body: object) {
    setBusy(item.sourceKey)
    setError('')
    try {
      const response = await fetch('/api/admin/force-curves/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Request failed')
      await refreshQueue()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setBusy('')
    }
  }

  async function resolve(item: Item, resolution: 'MANUALLY_APPROVED' | 'NO_MATCH') {
    const first = item.evidence.find(e => e.status === 'OPEN')!
    const candidate = first.candidates.find(c => c.id === first.catalogEntryId) || first.candidates[0]
    await mutate(item, { reviewId: first.id, resolution, catalogEntryId: resolution === 'MANUALLY_APPROVED' ? candidate?.id : undefined, reason: 'Admin source-centric queue decision' })
  }

  async function findMasters(item: Item) {
    const q = masterQuery[item.sourceKey] || ''
    if (q.trim().length < 2) {
      setError('MasterSwitch search requires at least 2 characters')
      return
    }
    setBusy(item.sourceKey)
    setError('')
    try {
      const first = item.evidence.find(e => e.status === 'OPEN')!
      const catalog = first.candidates.find(c => c.id === first.catalogEntryId) || first.candidates[0]
      if (!catalog) throw new Error('Select a catalog candidate before searching for a MasterSwitch')
      const response = await fetch(`/api/admin/force-curves/master-switches?query=${encodeURIComponent(q)}&catalogEntryId=${encodeURIComponent(catalog.id)}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Search failed')
      setMasterResults(value => ({ ...value, [item.sourceKey]: data }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setBusy('')
    }
  }

  async function chooseMaster(item: Item) {
    const first = item.evidence.find(e => e.status === 'OPEN')!
    const catalog = first.candidates.find(c => c.id === first.catalogEntryId) || first.candidates[0]
    const masterSwitchId = chosenMaster[item.sourceKey]
    const reviewIds = item.evidence.filter(e => e.status === 'OPEN').map(e => e.id)
    if (!catalog || !masterSwitchId) {
      setError('Select a catalog candidate and MasterSwitch')
      return
    }
    setBusy(item.sourceKey)
    setError('')
    try {
      const response = await fetch('/api/admin/force-curves/reviews', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reviewIds, masterSwitchId, catalogEntryId: catalog.id }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error === 'INCOMPATIBLE_IDENTITY' ? 'That MasterSwitch does not exactly match this catalog switch. Choose a compatible result.' : data.error || 'Link failed')
      await refreshQueue()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Link failed')
    } finally {
      setBusy('')
    }
  }

  return (
    <section className="space-y-5" aria-busy={Boolean(busy)}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Queue progress">
        <Stat label="Unique sources" value={queue.uniqueSourceCount} />
        <Stat label="Open sources" value={queue.openSourceCount} />
        <Stat label="Resolved sources" value={queue.resolvedSourceCount} />
        <Stat label="Actionable" value={queue.remainingActionable} />
        <Stat label="Deferred" value={queue.deferredCount} />
      </div>

      <div className="sticky top-0 z-10 grid gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-3 dark:border-gray-700 dark:bg-gray-800">
        <input className={controlClass} placeholder="Search source, switch, or path" aria-label="Search queue" value={query} onChange={e => setQuery(e.target.value)} />
        <select className={controlClass} aria-label="Bucket" value={bucket} onChange={e => setBucket(e.target.value)}>
          <option value="ALL">All buckets</option>
          {['ACTIONABLE', 'DUPLICATE', 'NO_MATCH', 'AMBIGUITY', 'CONFLICT', 'OTHER'].map(value => <option key={value} value={value}>{value} ({queue.counts[value] || 0})</option>)}
        </select>
        <select className={controlClass} aria-label="Status" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="OPEN">Open</option><option value="DEFERRED">Deferred</option><option value="RESOLVED">Resolved</option><option value="ALL">All statuses</option>
        </select>
      </div>

      {error && <div role="alert" className="flex items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"><span>{error}</span><button type="button" className="min-h-11 min-w-11 rounded-md font-bold hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:bg-red-900/60" onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
      {busy && <p className="text-sm font-medium text-blue-700 dark:text-blue-300" role="status">Updating queue…</p>}
      <p className="text-sm text-gray-600 dark:text-gray-400">Showing {queue.items.length} of {queue.filteredSourceCount} matching source items. Bulk approval appears only for homogeneous, exact, high-confidence repeated evidence.</p>

      <div className="space-y-4">
        {queue.items.map(item => {
          const first = item.evidence.find(e => e.id === item.primaryReviewId)!
          const candidate = first.candidates.find(c => c.id === first.catalogEntryId) || first.candidates[0]
          const master = first.masterSwitch
          const openReviewIds = item.evidence.filter(e => e.status === 'OPEN').map(e => e.id)
          return (
            <article key={item.sourceKey} className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <header className="flex flex-col gap-3 border-b border-gray-200 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6 dark:border-gray-700">
                <div className="min-w-0"><h2 className="break-words text-base font-semibold text-gray-900 dark:text-white">{item.sourceKey}</h2><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.evidence.length} evidence row{item.evidence.length === 1 ? '' : 's'} · confidence {Math.round(item.confidence * 100)}%</p></div>
                <StatusBadge value={item.deferred ? 'DEFERRED' : item.bucket} />
              </header>
              <div className="grid md:grid-cols-2">
                <div className="border-b border-gray-200 p-4 sm:p-6 md:border-b-0 md:border-r dark:border-gray-700">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Source identity & evidence</h3>
                  <p className="font-medium text-gray-900 dark:text-white">{candidate?.displayName || 'No catalog candidate'}</p>
                  <p className="mt-1 break-all text-sm text-gray-600 dark:text-gray-300">{candidate?.repositoryPath || first.reason}</p>
                  {candidate && <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-gray-400"><dt className="font-medium">Hash</dt><dd className="break-all">{candidate.contentHash || 'missing'}</dd><dt className="font-medium">Revision</dt><dd>{candidate.revision || 'unknown'}</dd></dl>}
                  <details className="mt-4 text-gray-700 dark:text-gray-300"><summary className="min-h-11 cursor-pointer rounded-md py-3 text-sm font-medium hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:text-blue-400">All evidence ({item.evidence.length})</summary><ul className="space-y-2 border-l-2 border-gray-200 pl-3 text-xs dark:border-gray-600">{item.evidence.map(e => <li key={e.id}><span className="font-semibold">{e.kind}:</span> {e.reason}</li>)}</ul></details>
                </div>
                <div className="p-4 sm:p-6">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Candidate MasterSwitch</h3>
                  {master ? <><p className="font-medium text-gray-900 dark:text-white">{master.manufacturer} {master.name}</p><p className="mt-1 break-words text-sm text-gray-600 dark:text-gray-300">{master.technology || 'Technology unknown'} · ID {master.id}</p></> : <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">No MasterSwitch attached.</p>}
                  {item.status === 'OPEN' && <div className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-900/40"><label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor={`master-${item.sourceKey}`}>Choose another MasterSwitch</label><div className="flex flex-col gap-2 sm:flex-row"><input id={`master-${item.sourceKey}`} className={`${controlClass} min-w-0 flex-1`} value={masterQuery[item.sourceKey] || candidate?.displayName || ''} onChange={e => setMasterQuery(value => ({ ...value, [item.sourceKey]: e.target.value }))} /><button type="button" disabled={Boolean(busy)} className={secondaryButtonClass} onClick={() => findMasters(item)}>Search</button></div>{(masterResults[item.sourceKey] || []).length > 0 && <><select className={`${controlClass} w-full`} aria-label={`Exact MasterSwitch for ${item.sourceKey}`} value={chosenMaster[item.sourceKey] || ''} onChange={e => setChosenMaster(value => ({ ...value, [item.sourceKey]: e.target.value }))}><option value="">Select exact master</option>{masterResults[item.sourceKey].map(m => <option key={m.id} value={m.id} disabled={!m.compatibility?.compatible}>{m.manufacturer} {m.name} — {m.technology}{m.compatibility?.compatible ? '' : ` — incompatible: ${m.compatibility?.reason || 'identity could not be verified'}`}</option>)}</select>{masterResults[item.sourceKey].some(m => !m.compatibility?.compatible) && <p className="text-xs text-amber-700 dark:text-amber-300">Incompatible search matches are disabled because their exact catalog identity differs.</p>}<button type="button" disabled={Boolean(busy) || !masterResults[item.sourceKey].some(m => m.id === chosenMaster[item.sourceKey] && m.compatibility?.compatible)} className="min-h-11 w-full rounded-md bg-blue-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus-visible:ring-offset-gray-800" onClick={() => chooseMaster(item)}>Attach selected MasterSwitch</button></>}</div>}
                </div>
              </div>
              {item.status === 'OPEN' && <footer className="flex flex-col gap-2 border-t border-gray-200 bg-gray-50 p-4 sm:flex-row sm:flex-wrap sm:px-6 dark:border-gray-700 dark:bg-gray-900/40">{item.actionable && candidate && <button type="button" disabled={Boolean(busy)} className="min-h-11 rounded-md bg-green-700 px-4 text-sm font-medium text-white transition-colors hover:bg-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-green-600 dark:hover:bg-green-700 dark:focus-visible:ring-offset-gray-800" onClick={() => openReviewIds.length > 1 ? mutate(item, { action: 'BULK_APPROVE', reviewIds: openReviewIds, catalogEntryId: candidate.id, reason: 'Homogeneous exact source evidence' }) : resolve(item, 'MANUALLY_APPROVED')}>{openReviewIds.length > 1 ? `Approve group (${openReviewIds.length})` : 'Approve suggestion'}</button>}{master && <button type="button" disabled={Boolean(busy)} className="min-h-11 rounded-md border border-red-300 bg-white px-4 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-300 dark:hover:bg-red-950/40 dark:focus-visible:ring-offset-gray-800" onClick={() => mutate(item, { action: 'GROUP_NO_MATCH', reviewIds: openReviewIds, reason: 'Admin source-centric durable no-match decision' })}>Durable NO_MATCH ({openReviewIds.length})</button>}<button type="button" disabled={Boolean(busy)} className={secondaryButtonClass} onClick={() => mutate(item, { action: 'DEFER', reviewIds: openReviewIds, reason: 'Deferred from admin queue' })}>{item.deferred ? 'Deferred' : 'Skip / defer'}</button></footer>}
            </article>
          )
        })}
      </div>
      {queue.pagination.pageCount > 1 && <nav className="flex items-center justify-between gap-3" aria-label="Queue pages"><button type="button" disabled={!queue.pagination.hasPrevious || Boolean(busy)} className={secondaryButtonClass} onClick={() => refreshQueue(queue.pagination.page - 1)}>Previous</button><span className="text-sm text-gray-600 dark:text-gray-400">Page {queue.pagination.page} of {queue.pagination.pageCount}</span><button type="button" disabled={!queue.pagination.hasNext || Boolean(busy)} className={secondaryButtonClass} onClick={() => refreshQueue(queue.pagination.page + 1)}>Next</button></nav>}
      {!queue.items.length && <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm dark:border-gray-600 dark:bg-gray-800"><h2 className="text-base font-semibold text-gray-900 dark:text-white">No source items found</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Try changing the search, bucket, or status filters.</p></div>}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"><div className="text-2xl font-semibold text-gray-900 dark:text-white">{value}</div><div className="mt-1 text-xs font-medium text-gray-500 dark:text-gray-400">{label}</div></div>
}

function StatusBadge({ value }: { value: string }) {
  const color = value === 'ACTIONABLE' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' : value === 'CONFLICT' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200' : value === 'DEFERRED' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
  return <span className={`self-start whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${color}`}>{value}</span>
}
