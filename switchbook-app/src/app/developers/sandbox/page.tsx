'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'

export default function PartnerSandboxPage() {
  const [apiKey, setApiKey] = useState('')
  const [query, setQuery] = useState('')
  const [result, setResult] = useState('Enter a scoped sandbox or production application key to make a catalog request.')
  const [loading, setLoading] = useState(false)

  async function run(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '5' })
      if (query.trim()) params.set('q', query.trim())
      const response = await fetch(`/api/v1/catalog/switches?${params}`, { headers: { 'X-API-Key': apiKey }, cache: 'no-store' })
      const body = await response.json().catch(() => ({ error: { code: 'invalid_response', message: 'The server did not return JSON.' } }))
      setResult(JSON.stringify({ status: response.status, requestId: response.headers.get('x-request-id'), etag: response.headers.get('etag'), body }, null, 2))
    } catch {
      setResult(JSON.stringify({ error: { code: 'network_error', message: 'The request could not be completed.' } }, null, 2))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 text-gray-900 dark:text-gray-100">
      <Link href="/developers" className="text-purple-600 hover:underline dark:text-purple-400">← Partner API</Link>
      <h1 className="mt-5 text-3xl font-bold">Catalog sandbox</h1>
      <p className="mt-3 text-gray-600 dark:text-gray-300">This client sends the key only to the same-origin SwitchBook API for this request. It is held in page memory and is not saved.</p>
      <form onSubmit={run} className="mt-8 space-y-5 rounded-lg border border-gray-200 p-6 dark:border-gray-700">
        <label className="block"><span className="font-medium">Application key</span><input type="password" autoComplete="off" required value={apiKey} onChange={event => setApiKey(event.target.value)} className="mt-2 w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 dark:border-gray-600" /></label>
        <label className="block"><span className="font-medium">Search query (optional)</span><input value={query} onChange={event => setQuery(event.target.value)} maxLength={120} className="mt-2 w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 dark:border-gray-600" /></label>
        <button disabled={loading} className="rounded-md bg-purple-600 px-5 py-2 font-medium text-white hover:bg-purple-700 disabled:opacity-50">{loading ? 'Requesting…' : 'GET /catalog/switches'}</button>
      </form>
      <pre aria-live="polite" className="mt-6 max-h-[32rem] overflow-auto rounded-lg bg-gray-950 p-5 text-sm text-green-300">{result}</pre>
      <p className="mt-6 text-sm"><a href="/openapi/partner-v1.yaml" className="text-purple-600 hover:underline dark:text-purple-400">OpenAPI 3.1 specification</a> · OAuth discovery: <a href="/.well-known/openid-configuration" className="text-purple-600 hover:underline dark:text-purple-400">issuer metadata</a></p>
    </main>
  )
}
