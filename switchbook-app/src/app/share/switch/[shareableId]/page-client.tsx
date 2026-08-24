'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import CanonicalSwitchShare from '@/components/CanonicalSwitchShare'
import { serializeCanonicalSwitchShare, type CanonicalSwitchShare as ShareModel } from '@/lib/canonical-switch-share'

export default function ShareMasterSwitchPageClient() {
  const { shareableId } = useParams<{ shareableId: string }>()
  const [share, setShare] = useState<ShareModel | null>(null)
  const [error, setError] = useState<string>()
  useEffect(() => { fetch(`/api/share/switch/${shareableId}`).then(async response => { if (!response.ok) throw new Error(response.status === 404 ? 'Switch not found' : 'Failed to load switch'); setShare(serializeCanonicalSwitchShare('master', await response.json())) }).catch(reason => setError(reason.message)) }, [shareableId])
  if (error) return <ShareError message={error} />
  if (!share) return <ShareLoading />
  return <CanonicalSwitchShare share={share} />
}

function ShareLoading() { return <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900"><div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" /></div> }
function ShareError({ message }: { message: string }) { return <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900"><div className="text-center"><h1 className="mb-4 text-2xl font-bold text-gray-900 dark:text-white">{message}</h1><p className="text-gray-600 dark:text-gray-400">This switch may have been removed or the link is invalid.</p></div></div> }
