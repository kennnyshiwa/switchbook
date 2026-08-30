'use client'

import { useEffect, useRef, useState } from 'react'
import { findNextRankedIndex } from '@/lib/admin-force-curve-suggestions'

type Candidate = { id: string; displayName: string; repositoryPath: string; revision: string | null; contentHash: string | null; manufacturer: string | null; technology: string | null }
type Master = { id: string; name: string; manufacturer: string | null; technology: string | null; compatibility?: { compatible: boolean; reason: string } }
type Evidence = { id: string; kind: string; reason: string; status: 'OPEN' | 'RESOLVED'; catalogEntryId: string | null; masterSwitch: Master | null; candidates: Candidate[] }
type Item = { sourceKey: string; primaryReviewId: string; bucket: string; confidence: number; actionable: boolean; deferred: boolean; status: 'OPEN' | 'RESOLVED'; evidence: Evidence[] }
type Queue = { items: Item[]; counts: Record<string, number>; rawReviewCount: number; uniqueSourceCount: number; openSourceCount: number; resolvedSourceCount: number; remainingActionable: number; deferredCount: number; filteredSourceCount: number; pagination: { page: number; pageSize: number; pageCount: number; hasPrevious: boolean; hasNext: boolean } }
type Suggestion = { algorithm: 'rank-v1'; tier: 'EXACT_UNIQUE' | 'BOUNDARY_UNIQUE'; reason: 'NORMALIZED_IDENTITY_EXACT' | 'FULL_IDENTITY_BOUNDARY'; master: Master; warnings: string[] }
type StagedAction = { sourceKey: string; kind: 'ATTACH_SUGGESTION' | 'DEFER' | 'NO_MATCH' }
type SuggestionState = { catalogEntryId: string; status: 'loading' | 'match' | 'none' | 'error'; suggestion: Suggestion | null; exclusion?: string }

const controlClass = 'min-h-11 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder:text-gray-400 dark:hover:border-gray-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/30'
const secondaryButtonClass = 'min-h-11 rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 dark:focus-visible:ring-offset-gray-800'

export default function ForceCurveReviewQueue({ initialQueue, rankAssistEnabled = false }: { initialQueue: Queue; rankAssistEnabled?: boolean }) {
  const [queue, setQueue] = useState(initialQueue)
  const [query, setQuery] = useState('')
  const [bucket, setBucket] = useState('ALL')
  const [status, setStatus] = useState('OPEN')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [masterQuery, setMasterQuery] = useState<Record<string, string>>({})
  const [masterResults, setMasterResults] = useState<Record<string, Master[]>>({})
  const [chosenMaster, setChosenMaster] = useState<Record<string, string>>({})
  const [overrideAcknowledged, setOverrideAcknowledged] = useState<Record<string, boolean>>({})
  const [overrideReason, setOverrideReason] = useState<Record<string, string>>({})
  const [suggestions, setSuggestions] = useState<Record<string, SuggestionState>>({})
  const [activeIndex, setActiveIndex] = useState(0)
  const [staged, setStaged] = useState<StagedAction | null>(null)
  const [scanning, setScanning] = useState(false)

  const initialLoad = useRef(true)
  const cardRefs = useRef<Record<string, HTMLElement | null>>({})
  const activeStartedAt = useRef(Date.now())

  function recordInteraction(event: string, sourceKey: string, details: Record<string, unknown> = {}) {
    if (!rankAssistEnabled) return
    try {
      const key = 'switchbook.forceCurveRankAssist.rank-v1'
      const current = JSON.parse(window.localStorage.getItem(key) || '[]') as unknown[]
      current.push({ event, sourceKey, at: new Date().toISOString(), activeMs: Math.max(0, Date.now() - activeStartedAt.current), ...details })
      window.localStorage.setItem(key, JSON.stringify(current.slice(-500)))
    } catch { /* Advisory telemetry must never block review work. */ }
  }

  function catalogFor(item: Item) {
    const first = item.evidence.find(e => e.id === item.primaryReviewId)
    return first?.candidates.find(c => c.id === first.catalogEntryId) || first?.candidates[0]
  }

  async function loadSuggestion(item: Item) {
    const catalog = catalogFor(item)
    if (!catalog) return null
    const current = suggestions[item.sourceKey]
    if (current?.catalogEntryId === catalog.id && current.status !== 'error') return current.suggestion
    setSuggestions(value => ({ ...value, [item.sourceKey]: { catalogEntryId: catalog.id, status: 'loading', suggestion: null } }))
    try {
      const response = await fetch(`/api/admin/force-curves/suggestions?catalogEntryId=${encodeURIComponent(catalog.id)}`)
      if (!response.ok) throw new Error(`Suggestion request failed (${response.status})`)
      const data = await response.json()
      const suggestion = data.suggestion as Suggestion | null
      setSuggestions(value => ({ ...value, [item.sourceKey]: { catalogEntryId: catalog.id, status: suggestion ? 'match' : 'none', suggestion, exclusion: data.exclusion } }))
      if (suggestion) recordInteraction('suggestion_shown', item.sourceKey, { tier: suggestion.tier, algorithm: suggestion.algorithm })
      return suggestion
    } catch {
      setSuggestions(value => ({ ...value, [item.sourceKey]: { catalogEntryId: catalog.id, status: 'error', suggestion: null } }))
      return null
    }
  }

  useEffect(() => {
    if (!rankAssistEnabled) return
    const targets = queue.items.slice(activeIndex, activeIndex + 2)
    for (const item of targets) {
      const catalog = catalogFor(item)
      const cached = suggestions[item.sourceKey]
      if (!catalog || cached?.catalogEntryId === catalog.id && cached.status !== 'error') continue
      void loadSuggestion(item)
    }
  // Suggestions are deliberately lazy: active card plus one-card lookahead only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, queue.items, rankAssistEnabled])

  useEffect(() => {
    if (!rankAssistEnabled) return
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const item = queue.items[activeIndex]
      if (!item) return
      // Escape must always make a staged decision reversible, including when
      // focus is inside the confirmation dialog or on either dialog button.
      if (event.key === 'Escape' && staged) { event.preventDefault(); recordInteraction('staged_cleared', staged.sourceKey); setStaged(null); return }
      if (target?.closest('input, select, textarea, button, a, [contenteditable="true"], [role="dialog"]')) return
      if (staged && staged.sourceKey === item.sourceKey && event.key === 'Enter') {
        event.preventDefault(); void confirmStaged(item); return
      }
      if (event.key === 'j' || event.key === 'ArrowDown' || event.key === 'k' || event.key === 'ArrowUp') {
        event.preventDefault()
        const delta = event.key === 'j' || event.key === 'ArrowDown' ? 1 : -1
        const next = Math.max(0, Math.min(queue.items.length - 1, activeIndex + delta))
        setActiveIndex(next); activeStartedAt.current = Date.now(); cardRefs.current[queue.items[next]?.sourceKey]?.focus(); return
      }
      const kind = event.key === 'a' && suggestions[item.sourceKey]?.suggestion ? 'ATTACH_SUGGESTION' : event.key === 'd' ? 'DEFER' : event.key === 'n' && item.evidence.some(e => e.masterSwitch) ? 'NO_MATCH' : null
      if (kind) { event.preventDefault(); setStaged({ sourceKey: item.sourceKey, kind }); recordInteraction('action_staged', item.sourceKey, { kind }) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, queue.items, rankAssistEnabled, staged, suggestions])

  async function findNextSuggestion() {
    setScanning(true)
    setError('')
    try {
      const index = await findNextRankedIndex(queue.items, activeIndex, loadSuggestion)
      if (index !== null) {
        setActiveIndex(index)
        window.requestAnimationFrame(() => cardRefs.current[queue.items[index].sourceKey]?.focus())
        return
      }
      setError('No deterministic ranked suggestion was found on this page. Manual search remains available.')
    } finally {
      setScanning(false)
    }
  }

  async function refreshQueue(page = queue.pagination.page, signal?: AbortSignal) {
    const params = new URLSearchParams({ page: String(page), pageSize: String(queue.pagination.pageSize), query, bucket, status })
    const timeout = new AbortController()
    const timer = window.setTimeout(() => timeout.abort(), 15_000)
    const abort = () => timeout.abort()
    signal?.addEventListener('abort', abort, { once: true })
    try {
      const fresh = await fetch(`/api/admin/force-curves/reviews?${params}`, { signal: timeout.signal })
      if (!fresh.ok) throw new Error('Saved, but refresh failed')
      setQueue(await fresh.json())
    } finally {
      window.clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
    }
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
    const first = item.evidence.find(e => e.status === 'OPEN')!
    const catalog = first.candidates.find(c => c.id === first.catalogEntryId) || first.candidates[0]
    const q = masterQuery[item.sourceKey] ?? catalog?.displayName ?? ''
    if (q.trim().length < 2) {
      setError('MasterSwitch search requires at least 2 characters')
      return
    }
    setBusy(item.sourceKey)
    setError('')
    try {
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
    const selectedMaster = masterResults[item.sourceKey]?.find(master => master.id === masterSwitchId)
    const override = selectedMaster?.compatibility?.compatible === false
    const reviewIds = item.evidence.filter(e => e.status === 'OPEN').map(e => e.id)
    if (!catalog || !masterSwitchId) {
      setError('Select a catalog candidate and MasterSwitch')
      return
    }
    setBusy(item.sourceKey)
    setError('')
    try {
      const response = await fetch('/api/admin/force-curves/reviews', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reviewIds, masterSwitchId, catalogEntryId: catalog.id, ...(override ? { compatibilityOverride: { acknowledged: overrideAcknowledged[item.sourceKey] === true, reason: overrideReason[item.sourceKey] || '' } } : {}) }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error === 'INCOMPATIBLE_IDENTITY' ? 'That MasterSwitch does not exactly match this catalog switch. Choose a compatible result.' : data.error === 'REVIEW_CANDIDATE_REQUIRED' ? 'The source evidence changed while this page was open. Refresh the queue, search again, and select the exact MasterSwitch.' : data.error || 'Link failed')
      if (selectedMaster) {
        setQueue(current => ({ ...current, items: current.items.map(currentItem => currentItem.sourceKey !== item.sourceKey ? currentItem : {
          ...currentItem,
          evidence: currentItem.evidence.map(evidence => reviewIds.includes(evidence.id) ? { ...evidence, catalogEntryId: catalog.id, masterSwitch: selectedMaster } : evidence),
        }) }))
      }
      setBusy('')
      try {
        await refreshQueue()
      } catch {
        setError('MasterSwitch attached successfully, but the queue refresh timed out. Reload the page to fetch the latest queue state.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Link failed')
    } finally {
      setBusy('')
    }
  }

  async function attachSuggestion(item: Item) {
    const suggestionState = suggestions[item.sourceKey]
    const suggestion = suggestionState?.suggestion
    const first = item.evidence.find(e => e.status === 'OPEN')
    const catalog = first?.candidates.find(c => c.id === first.catalogEntryId) || first?.candidates[0]
    const reviewIds = item.evidence.filter(e => e.status === 'OPEN').map(e => e.id)
    if (!suggestion || !catalog || suggestionState.catalogEntryId !== catalog.id || !reviewIds.length) throw new Error('Suggestion is no longer available')
    setBusy(item.sourceKey); setError('')
    try {
      const response = await fetch('/api/admin/force-curves/reviews', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reviewIds, masterSwitchId: suggestion.master.id, catalogEntryId: catalog.id }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'The guarded attachment was rejected')
      recordInteraction('suggestion_confirmed', item.sourceKey, { tier: suggestion.tier, masterSwitchId: suggestion.master.id })
      await refreshQueue()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Suggestion attachment failed')
    } finally { setBusy('') }
  }

  async function confirmStaged(item: Item) {
    if (!staged || staged.sourceKey !== item.sourceKey) return
    const action = staged.kind
    setStaged(null)
    const reviewIds = item.evidence.filter(e => e.status === 'OPEN').map(e => e.id)
    if (action === 'ATTACH_SUGGESTION') return attachSuggestion(item)
    if (action === 'DEFER') return mutate(item, { action: 'DEFER', reviewIds, reason: 'Deferred from rank-assist review queue' })
    return mutate(item, { action: 'GROUP_NO_MATCH', reviewIds, reason: 'Admin source-centric durable no-match decision' })
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
      <p className="text-sm text-gray-600 dark:text-gray-400">Showing {queue.items.length} of {queue.filteredSourceCount} matching source items. {rankAssistEnabled ? 'Rank assist is advisory: j/k moves, a/d/n stages an action, Enter confirms, and Escape clears. No shortcut writes immediately.' : 'Bulk approval appears only for homogeneous exact repeated evidence.'}</p>
      {rankAssistEnabled && <div className="flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 sm:flex-row sm:items-center sm:justify-between dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100" data-testid="force-curve-rank-status"><div><p className="font-semibold">Rank assist enabled</p><p className="mt-1 text-xs">{Object.values(suggestions).filter(value => value.status !== 'loading').length} of {queue.items.length} groups checked on this page · {Object.values(suggestions).filter(value => value.status === 'match').length} deterministic suggestion(s) found.</p></div><button type="button" className={secondaryButtonClass} disabled={Boolean(busy) || scanning} onClick={() => void findNextSuggestion()}>{scanning ? 'Finding suggestion…' : 'Find next suggestion'}</button></div>}

      <div className="space-y-4">
        {queue.items.map(item => {
          const first = item.evidence.find(e => e.id === item.primaryReviewId)!
          const candidate = first.candidates.find(c => c.id === first.catalogEntryId) || first.candidates[0]
          const master = first.masterSwitch
          const openReviewIds = item.evidence.filter(e => e.status === 'OPEN').map(e => e.id)
          const selectedMaster = masterResults[item.sourceKey]?.find(result => result.id === chosenMaster[item.sourceKey])
          const requiresOverride = selectedMaster?.compatibility?.compatible === false
          const suggestionState = suggestions[item.sourceKey]
          const suggestion = suggestionState?.suggestion
          const isActive = activeIndex === queue.items.indexOf(item)
          return (
            <article key={item.sourceKey} ref={node => { cardRefs.current[item.sourceKey] = node }} tabIndex={rankAssistEnabled ? 0 : undefined} onFocus={() => { setActiveIndex(queue.items.indexOf(item)); activeStartedAt.current = Date.now() }} className={`overflow-hidden rounded-lg border bg-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-gray-800 ${isActive && rankAssistEnabled ? 'border-blue-400 dark:border-blue-500' : 'border-gray-200 dark:border-gray-700'}`}>
              <header className="flex flex-col gap-3 border-b border-gray-200 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6 dark:border-gray-700">
                <div className="min-w-0"><h2 className="break-words text-base font-semibold text-gray-900 dark:text-white">{item.sourceKey}</h2><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.evidence.length} evidence row{item.evidence.length === 1 ? '' : 's'} · {rankAssistEnabled ? `deterministic queue class ${item.bucket}` : `confidence ${Math.round(item.confidence * 100)}%`}</p></div>
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
                  {rankAssistEnabled && suggestion && item.status === 'OPEN' && <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100" data-testid="force-curve-rank-suggestion"><p className="font-semibold">Ranked suggestion: {suggestion.master.manufacturer} {suggestion.master.name}</p><p className="mt-1 text-xs">{suggestion.reason === 'NORMALIZED_IDENTITY_EXACT' ? 'Normalized source identity exactly matches one approved MasterSwitch.' : 'The complete normalized identity occurs at a word boundary in exactly one approved MasterSwitch.'} Algorithm {suggestion.algorithm}; this is not a probability.</p>{suggestion.warnings.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-800 dark:text-amber-200">{suggestion.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}<button type="button" className={`${secondaryButtonClass} mt-3 w-full`} disabled={Boolean(busy)} onClick={() => { setStaged({ sourceKey: item.sourceKey, kind: 'ATTACH_SUGGESTION' }); recordInteraction('action_staged', item.sourceKey, { kind: 'ATTACH_SUGGESTION' }) }}>Stage suggestion (A)</button></div>}
                  {rankAssistEnabled && isActive && suggestionState?.status === 'loading' && <p className="mt-4 rounded-md bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">Checking for a deterministic suggestion…</p>}
                  {rankAssistEnabled && isActive && suggestionState?.status === 'none' && <p className="mt-4 rounded-md bg-gray-100 p-3 text-sm text-gray-700 dark:bg-gray-700 dark:text-gray-200">No deterministic suggestion for this group. Manual search remains available.</p>}
                  {rankAssistEnabled && isActive && suggestionState?.status === 'error' && <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"><p>Rank assist could not check this group.</p><button type="button" className={`${secondaryButtonClass} mt-2`} onClick={() => void loadSuggestion(item)}>Retry</button></div>}
                  {item.status === 'OPEN' && <div className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-900/40"><label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor={`master-${item.sourceKey}`}>Choose another MasterSwitch</label><form className="flex flex-col gap-2 sm:flex-row" onSubmit={event => { event.preventDefault(); void findMasters(item) }}><input id={`master-${item.sourceKey}`} className={`${controlClass} min-w-0 flex-1`} value={masterQuery[item.sourceKey] ?? candidate?.displayName ?? ''} onChange={e => setMasterQuery(value => ({ ...value, [item.sourceKey]: e.target.value }))} /><button type="submit" disabled={Boolean(busy)} className={secondaryButtonClass}>Search</button></form>{(masterResults[item.sourceKey] || []).length > 0 && <><select className={`${controlClass} w-full`} aria-label={`Exact MasterSwitch for ${item.sourceKey}`} value={chosenMaster[item.sourceKey] || ''} onChange={e => { setChosenMaster(value => ({ ...value, [item.sourceKey]: e.target.value })); setOverrideAcknowledged(value => ({ ...value, [item.sourceKey]: false })); setOverrideReason(value => ({ ...value, [item.sourceKey]: '' })) }}><option value="">Select exact master</option>{masterResults[item.sourceKey].map(m => <option key={m.id} value={m.id}>{m.manufacturer} {m.name} — {m.technology}{m.compatibility?.compatible ? '' : ` — warning: ${m.compatibility?.reason || 'identity could not be verified'}`}</option>)}</select>{requiresOverride && <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"><p><strong>Compatibility warning:</strong> {selectedMaster?.compatibility?.reason || 'The exact identity could not be verified.'}</p><label className="flex items-start gap-2"><input type="checkbox" className="mt-1 h-4 w-4" checked={overrideAcknowledged[item.sourceKey] || false} onChange={e => setOverrideAcknowledged(value => ({ ...value, [item.sourceKey]: e.target.checked }))} /><span>I verified this is the intended MasterSwitch and want to override the warning.</span></label><label className="block font-medium" htmlFor={`override-reason-${item.sourceKey}`}>Audit reason</label><textarea id={`override-reason-${item.sourceKey}`} className={`${controlClass} min-h-20 w-full py-2`} value={overrideReason[item.sourceKey] || ''} onChange={e => setOverrideReason(value => ({ ...value, [item.sourceKey]: e.target.value }))} placeholder="Why this source belongs to this MasterSwitch" /></div>}{masterResults[item.sourceKey].some(m => !m.compatibility?.compatible) && !requiresOverride && <p className="text-xs text-amber-700 dark:text-amber-300">Results with identity warnings remain selectable, but require an acknowledged, audited admin override.</p>}<button type="button" disabled={Boolean(busy) || !selectedMaster || Boolean(requiresOverride && (!overrideAcknowledged[item.sourceKey] || (overrideReason[item.sourceKey] || '').trim().length < 3))} className="min-h-11 w-full rounded-md bg-blue-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus-visible:ring-offset-gray-800" onClick={() => chooseMaster(item)}>Attach selected MasterSwitch</button></>}</div>}
                </div>
              </div>
              {staged?.sourceKey === item.sourceKey && <div role="dialog" aria-label="Confirm staged force curve decision" className="border-t border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100"><p><strong>Confirm deliberate action:</strong> {staged.kind === 'ATTACH_SUGGESTION' ? `attach ${suggestion?.master.manufacturer || ''} ${suggestion?.master.name || ''}` : staged.kind === 'DEFER' ? 'defer this entire source group' : 'record durable no-match for this source group'}.</p><p className="mt-1 text-xs">Nothing has been written yet. Confirm revalidates the complete group through the existing fail-closed server gate.</p><div className="mt-3 flex gap-2"><button type="button" autoFocus className="min-h-11 rounded-md bg-blue-700 px-4 font-medium text-white" onClick={() => void confirmStaged(item)}>Confirm (Enter)</button><button type="button" className={secondaryButtonClass} onClick={() => { recordInteraction('staged_cleared', item.sourceKey); setStaged(null) }}>Cancel (Escape)</button></div></div>}
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
