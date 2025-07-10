'use client'

import { useState } from 'react'

interface User {
  id: string
  email: string
  username: string
  role: string
  _count: {
    switches: number
  }
}

interface MergeAccountsModalProps {
  isOpen: boolean
  onClose: () => void
  users: User[]
  onMergeComplete: () => void
}

export default function MergeAccountsModal({ 
  isOpen, 
  onClose, 
  users, 
  onMergeComplete 
}: MergeAccountsModalProps) {
  const [sourceUserId, setSourceUserId] = useState('')
  const [targetUserId, setTargetUserId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(1)

  if (!isOpen) return null

  const sourceUser = users.find(u => u.id === sourceUserId)
  const targetUser = users.find(u => u.id === targetUserId)

  const handleMerge = async () => {
    if (!sourceUserId || !targetUserId) {
      setError('Please select both users')
      return
    }

    if (sourceUserId === targetUserId) {
      setError('Cannot merge user with themselves')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/admin/users/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceUserId, targetUserId }),
      })

      const data = await response.json()

      if (response.ok) {
        alert(`Successfully merged accounts! Moved ${data.switchesMoved} switches and ${data.accountsMoved} OAuth accounts.`)
        onMergeComplete()
        handleClose()
      } else {
        setError(data.error || 'Failed to merge accounts')
      }
    } catch (error) {
      // Error merging accounts
      setError('An error occurred while merging accounts')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setSourceUserId('')
    setTargetUserId('')
    setError('')
    setStep(1)
    onClose()
  }

  const nonAdminUsers = users.filter(u => u.role !== 'ADMIN')

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 dark:bg-gray-900 opacity-75"></div>
        </div>

        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div className="mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Merge User Accounts
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              This will move all data from the source account to the target account and delete the source account.
            </p>
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Source Account (will be deleted)
                </label>
                <select
                  value={sourceUserId}
                  onChange={(e) => setSourceUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                >
                  <option value="">Select source account...</option>
                  {nonAdminUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.username} ({user.email}) - {user._count.switches} switches
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Target Account (will receive all data)
                </label>
                <select
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                >
                  <option value="">Select target account...</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id} disabled={user.id === sourceUserId}>
                      {user.username} ({user.email}) - {user._count.switches} switches
                    </option>
                  ))}
                </select>
              </div>

              {sourceUserId && targetUserId && sourceUserId !== targetUserId && (
                <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-md">
                  <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                    Merge Preview
                  </h4>
                  <div className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                    <p><strong>Source:</strong> {sourceUser?.username} ({sourceUser?.email})</p>
                    <p><strong>Target:</strong> {targetUser?.username} ({targetUser?.email})</p>
                    <p><strong>Switches to move:</strong> {sourceUser?._count.switches || 0}</p>
                    <p className="text-red-600 dark:text-red-400 font-medium">
                      ⚠️ The source account will be permanently deleted
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="text-red-600 dark:text-red-400 text-sm mt-2">
                  {error}
                </div>
              )}

              <div className="flex justify-between pt-4">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={() => setStep(2)}
                  disabled={!sourceUserId || !targetUserId || sourceUserId === targetUserId || isLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-500 dark:hover:bg-yellow-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Review Merge
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md">
                <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                  ⚠️ Final Confirmation
                </h4>
                <div className="text-sm text-red-700 dark:text-red-300 space-y-2">
                  <p>You are about to merge these accounts:</p>
                  <div className="bg-white dark:bg-gray-800 p-3 rounded border">
                    <p><strong>FROM:</strong> {sourceUser?.username} ({sourceUser?.email})</p>
                    <p><strong>TO:</strong> {targetUser?.username} ({targetUser?.email})</p>
                  </div>
                  <p className="font-medium">This action will:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Move {sourceUser?._count.switches || 0} switches to {targetUser?.username}</li>
                    <li>Transfer OAuth accounts (Discord, etc.)</li>
                    <li>Move force curve preferences</li>
                    <li>Permanently delete {sourceUser?.username}&apos;s account</li>
                  </ul>
                  <p className="font-bold text-red-800 dark:text-red-200">
                    This action cannot be undone!
                  </p>
                </div>
              </div>

              {error && (
                <div className="text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
                  disabled={isLoading}
                >
                  Back
                </button>
                <button
                  onClick={handleMerge}
                  disabled={isLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Merging...' : 'Confirm Merge'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}