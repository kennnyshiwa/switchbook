import Link from 'next/link'

export default function AuthErrorPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12">
      <div className="max-w-md space-y-6 text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Unable to sign in</h1>
        <p className="text-gray-600 dark:text-gray-400">
          We couldn’t complete your sign-in. Please return to the login page and try again.
        </p>
        <Link
          href="/auth/login"
          className="inline-flex rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          Back to sign in
        </Link>
      </div>
    </main>
  )
}
