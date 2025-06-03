'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signOut } from 'next-auth/react'

interface AccountSettingsProps {
  user: {
    id: string
    email: string
    username: string
    role: string
    shareableId: string
    _count: {
      switches: number
    }
  }
}

export default function AccountSettings({ user }: AccountSettingsProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${user.shareableId}`

  const handleDeleteAccount = async () => {
    const confirmMessage = `Are you sure you want to delete your account? This will permanently delete:\n\n` +
      `• Your account\n` +
      `• ${user._count.switches} switches in your collection\n` +
      `• All associated data\n\n` +
      `This action cannot be undone.`

    if (!confirm(confirmMessage)) return

    // Double confirmation for safety
    const username = prompt('Please type your username to confirm deletion:')
    if (username !== user.username) {
      alert('Username does not match. Account deletion cancelled.')
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch('/api/account', {
        method: 'DELETE',
      })

      if (response.ok) {
        await signOut({ callbackUrl: '/' })
      } else {
        alert('Failed to delete account. Please try again.')
      }
    } catch (error) {
      console.error('Error deleting account:', error)
      alert('An error occurred. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex space-x-4 mb-6">
        <Link
          href="/dashboard"
          className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
        >
          ← Back to Dashboard
        </Link>
        {user.role === 'ADMIN' && (
          <Link
            href="/admin"
            className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Admin Dashboard
          </Link>
        )}
      </div>

      {/* Account Information */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Account Information</h2>
        <dl className="space-y-4">
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Username</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white">{user.username}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white">{user.email}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Role</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white">
              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                user.role === 'ADMIN' 
                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' 
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {user.role}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Collection Size</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white">{user._count.switches} switches</dd>
          </div>
        </dl>
      </div>

      {/* Share Link */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Share Your Collection</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Share this link with others to let them view your switch collection:
        </p>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-gray-50 dark:bg-gray-700 dark:text-white"
          />
          <button
            onClick={() => {
              navigator.clipboard.writeText(shareUrl)
              alert('Link copied to clipboard!')
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Copy
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border-2 border-red-200 dark:border-red-800">
        <h2 className="text-lg font-medium text-red-900 dark:text-red-400 mb-4">Danger Zone</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Once you delete your account, there is no going back. Please be certain.
        </p>
        <button
          onClick={handleDeleteAccount}
          disabled={isDeleting}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
        >
          {isDeleting ? 'Deleting...' : 'Delete Account'}
        </button>
      </div>
    </div>
  )
}