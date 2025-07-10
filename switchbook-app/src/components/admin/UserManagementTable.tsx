'use client'

import { useState } from 'react'
import { UserRole } from '@prisma/client'
import MergeAccountsModal from './MergeAccountsModal'

interface User {
  id: string
  email: string
  username: string
  role: UserRole
  emailVerified: Date | null
  shareableId: string
  createdAt: Date
  _count: {
    switches: number
  }
}

interface UserManagementTableProps {
  users: User[]
  currentUserId: string
}

export default function UserManagementTable({ users, currentUserId }: UserManagementTableProps) {
  const [isResetting, setIsResetting] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isUpdatingRole, setIsUpdatingRole] = useState<string | null>(null)
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isResendingVerification, setIsResendingVerification] = useState<string | null>(null)

  const getShareUrl = (shareableId: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : process.env.NEXTAUTH_URL || ''
    return `${baseUrl}/share/${shareableId}`
  }

  const copyShareLink = (shareableId: string) => {
    const shareUrl = getShareUrl(shareableId)
    navigator.clipboard.writeText(shareUrl)
    setCopiedId(shareableId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleResendVerification = async (userId: string) => {
    if (!confirm('Are you sure you want to resend the verification email for this user?')) return

    setIsResendingVerification(userId)
    try {
      const response = await fetch(`/api/admin/users/${userId}/resend-verification`, {
        method: 'POST',
      })

      if (response.ok) {
        alert('Verification email sent successfully.')
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to send verification email')
      }
    } catch (error) {
      // Error resending verification
      alert('An error occurred')
    } finally {
      setIsResendingVerification(null)
    }
  }

  const handleResetPassword = async (userId: string) => {
    if (!confirm('Are you sure you want to reset this user\'s password?')) return

    setIsResetting(userId)
    try {
      const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
      })

      if (response.ok) {
        alert('Password reset successfully. The user will receive an email with the new password.')
      } else {
        alert('Failed to reset password')
      }
    } catch (error) {
      // Error resetting password
      alert('An error occurred')
    } finally {
      setIsResetting(null)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return

    setIsDeleting(userId)
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        window.location.reload()
      } else {
        alert('Failed to delete user')
      }
    } catch (error) {
      // Error deleting user
      alert('An error occurred')
    } finally {
      setIsDeleting(null)
    }
  }

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    const action = newRole === 'ADMIN' ? 'promote' : 'demote'
    if (!confirm(`Are you sure you want to ${action} this user?`)) return

    setIsUpdatingRole(userId)
    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })

      if (response.ok) {
        window.location.reload()
      } else {
        const data = await response.json()
        alert(data.error || `Failed to ${action} user`)
      }
    } catch (error) {
      // Error updating role
      alert('An error occurred')
    } finally {
      setIsUpdatingRole(null)
    }
  }

  return (
    <>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setIsMergeModalOpen(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-500 dark:hover:bg-yellow-600 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
        >
          Merge Accounts
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              User
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Role
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Switches
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Share Link
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Joined
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {users.map((user) => (
            <tr key={user.id}>
              <td className="px-6 py-4 whitespace-nowrap">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{user.username}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  user.role === 'ADMIN' 
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' 
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {user.role}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {user.emailVerified ? (
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    Verified
                  </span>
                ) : (
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                    Unverified
                  </span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {user._count.switches}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => copyShareLink(user.shareableId)}
                    className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center space-x-1"
                    title="Copy share link"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>{copiedId === user.shareableId ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                  <a
                    href={getShareUrl(user.shareableId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                    title="Open share link"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                {new Date(user.createdAt).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                {user.id !== currentUserId && (
                  <>
                    {user.role === 'USER' ? (
                      <button
                        onClick={() => handleRoleChange(user.id, 'ADMIN')}
                        disabled={isUpdatingRole === user.id}
                        className="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300 disabled:opacity-50"
                      >
                        {isUpdatingRole === user.id ? 'Updating...' : 'Make Admin'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRoleChange(user.id, 'USER')}
                        disabled={isUpdatingRole === user.id}
                        className="text-orange-600 hover:text-orange-900 dark:text-orange-400 dark:hover:text-orange-300 disabled:opacity-50"
                      >
                        {isUpdatingRole === user.id ? 'Updating...' : 'Remove Admin'}
                      </button>
                    )}
                    {!user.emailVerified && (
                      <button
                        onClick={() => handleResendVerification(user.id)}
                        disabled={isResendingVerification === user.id}
                        className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 disabled:opacity-50"
                      >
                        {isResendingVerification === user.id ? 'Sending...' : 'Resend Verification'}
                      </button>
                    )}
                    <button
                      onClick={() => handleResetPassword(user.id)}
                      disabled={isResetting === user.id}
                      className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
                    >
                      {isResetting === user.id ? 'Resetting...' : 'Reset Password'}
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      disabled={isDeleting === user.id}
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                    >
                      {isDeleting === user.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    
    <MergeAccountsModal 
      isOpen={isMergeModalOpen}
      onClose={() => setIsMergeModalOpen(false)}
      users={users}
      onMergeComplete={() => window.location.reload()}
    />
    </>
  )
}