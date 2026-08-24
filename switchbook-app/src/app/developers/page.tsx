import Link from 'next/link'

export default function DevelopersPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12 text-gray-900 dark:text-gray-100">
      <h1 className="text-4xl font-bold">SwitchBook Partner API</h1>
      <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
        Integrate the canonical mechanical-switch catalog and submit user-authorized contributions for moderation.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/developers/sandbox" className="rounded-md bg-purple-600 px-5 py-3 font-medium text-white hover:bg-purple-700">Open API sandbox</Link>
        <a href="/openapi/partner-v1.yaml" className="rounded-md border border-gray-300 px-5 py-3 font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800">Download OpenAPI 3.1</a>
      </div>
      <section className="mt-12 grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 p-6 dark:border-gray-700">
          <h2 className="text-xl font-semibold">Catalog access</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-300">Use a revocable application key with the <code>catalog:read</code> scope. Conditional requests, cursor pagination, batch reads, and lifecycle tombstones are supported.</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-6 dark:border-gray-700">
          <h2 className="text-xl font-semibold">User authorization</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-300">OAuth authorization code flow requires S256 PKCE and explicit consent. Refresh tokens rotate; replay detection and revocation are enforced.</p>
        </div>
      </section>
      <p className="mt-10 text-sm text-gray-500">Credentials are issued to approved partners. Never put an application key or client secret in browser-delivered production code.</p>
    </main>
  )
}
