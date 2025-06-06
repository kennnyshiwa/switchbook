'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { changePasswordSchema } from '@/lib/validation'

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>

interface AccountSettingsProps {
  user: {
    id: string
    email: string
    username: string
    role: string
    shareableId: string
    showForceCurves: boolean
    password: string | null
    accounts: Array<{
      provider: string
    }>
    _count: {
      switches: number
    }
  }
}

export default function AccountSettings({ user }: AccountSettingsProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [showForceCurves, setShowForceCurves] = useState(user.showForceCurves)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false)
  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${user.shareableId}`

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    formState: { errors: passwordErrors },
    reset: resetPasswordForm,
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
  })

  const handleForceCurvesToggle = async (enabled: boolean) => {
    setIsUpdating(true)
    try {
      const response = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showForceCurves: enabled })
      })

      if (response.ok) {
        setShowForceCurves(enabled)
      } else {
        alert('Failed to update setting. Please try again.')
        setShowForceCurves(!enabled) // Revert on error
      }
    } catch (error) {
      console.error('Error updating force curves setting:', error)
      alert('An error occurred. Please try again.')
      setShowForceCurves(!enabled) // Revert on error
    } finally {
      setIsUpdating(false)
    }
  }

  const handlePasswordChange = async (data: ChangePasswordFormData) => {
    setIsChangingPassword(true)
    setPasswordChangeSuccess(false)
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      if (response.ok) {
        setPasswordChangeSuccess(true)
        resetPasswordForm()
        setTimeout(() => setPasswordChangeSuccess(false), 5000)
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to change password. Please try again.')
      }
    } catch (error) {
      console.error('Error changing password:', error)
      alert('An error occurred. Please try again.')
    } finally {
      setIsChangingPassword(false)
    }
  }

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
          {user.accounts.length > 0 && (
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Connected Accounts</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                <div className="flex flex-wrap gap-2">
                  {user.accounts.map((account, index) => (
                    <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {account.provider === 'discord' ? 'Discord' : account.provider}
                    </span>
                  ))}
                </div>
              </dd>
            </div>
          )}
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

      {/* Preferences */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Preferences</h2>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">Force Curves</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Display force curve buttons on switches when available. This enables access to detailed switch analysis charts and data.
              </p>
            </div>
            <div className="flex items-center ml-4">
              <button
                type="button"
                onClick={() => handleForceCurvesToggle(!showForceCurves)}
                disabled={isUpdating}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-600 focus:ring-offset-2 disabled:opacity-50 ${
                  showForceCurves ? 'bg-purple-600' : 'bg-gray-200 dark:bg-gray-600'
                }`}
                role="switch"
                aria-checked={showForceCurves}
                title={showForceCurves ? 'Disable force curves' : 'Enable force curves'}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    showForceCurves ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Security */}
      {user.password && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Security</h2>
          
          <form onSubmit={handlePasswordSubmit(handlePasswordChange)} className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Change Password</h3>
              
              {passwordChangeSuccess && (
                <div className="mb-4 rounded-md bg-green-50 dark:bg-green-900/20 p-4">
                  <p className="text-sm text-green-800 dark:text-green-400">Password changed successfully!</p>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Current Password
                  </label>
                  <input
                    {...registerPassword('currentPassword')}
                    type="password"
                    autoComplete="current-password"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                  />
                  {passwordErrors.currentPassword && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{passwordErrors.currentPassword.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    New Password
                  </label>
                  <input
                    {...registerPassword('newPassword')}
                    type="password"
                    autoComplete="new-password"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                  />
                  {passwordErrors.newPassword && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{passwordErrors.newPassword.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Confirm New Password
                  </label>
                  <input
                    {...registerPassword('confirmPassword')}
                    type="password"
                    autoComplete="new-password"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                  />
                  {passwordErrors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{passwordErrors.confirmPassword.message}</p>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isChangingPassword ? 'Changing...' : 'Change Password'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

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