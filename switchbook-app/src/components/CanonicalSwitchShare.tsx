'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { SWITCH_TECHNOLOGY_COLORS, SWITCH_TYPE_COLORS } from '@/constants/switchTypes'
import type { CanonicalSwitchShare as ShareModel } from '@/lib/canonical-switch-share'
import ForceCurvesButton from '@/components/ForceCurvesButton'
import SwitchScoresButton from '@/components/SwitchScoresButton'

export function CanonicalShareImage({ share }: { share: ShareModel }) {
  const [index, setIndex] = useState(0)
  const [failedIndexes, setFailedIndexes] = useState<Set<number>>(() => new Set())
  const image = share.images[index]
  const showImage = image && !failedIndexes.has(index)

  const handleError = () => {
    const failed = new Set(failedIndexes).add(index)
    const next = share.images.findIndex((_, candidate) => !failed.has(candidate))
    setFailedIndexes(failed)
    if (next >= 0) setIndex(next)
  }

  const selectImage = (itemIndex: number) => {
    setFailedIndexes(previous => {
      const retryable = new Set(previous)
      retryable.delete(itemIndex)
      return retryable
    })
    setIndex(itemIndex)
  }

  return (
    <div data-testid={showImage ? 'share-image' : 'share-image-fallback'} className="relative h-96 w-full overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
      {showImage ? (
        <img src={image.url} alt={image.alt || `${share.manufacturer ? `${share.manufacturer} ` : ''}${share.name}`} className="h-full w-full object-contain" onError={handleError} />
      ) : (
        <div className="px-6 text-center text-gray-500 dark:text-gray-400" aria-label="No switch image available">
          <div className="mx-auto mb-3 h-16 w-16 rounded-full border-4 border-current opacity-30" />
          No image available
        </div>
      )}
      {share.images.length > 1 && failedIndexes.size < share.images.length && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
          {share.images.map((item, itemIndex) => <button key={item.id || item.url} aria-label={`${failedIndexes.has(itemIndex) ? 'Retry' : 'Show'} image ${itemIndex + 1}`} onClick={() => selectImage(itemIndex)} className={`h-2.5 w-2.5 rounded-full ${itemIndex === index && !failedIndexes.has(itemIndex) ? 'bg-blue-600' : failedIndexes.has(itemIndex) ? 'bg-red-400' : 'bg-white/80'}`} />)}
        </div>
      )}
    </div>
  )
}

export default function CanonicalSwitchShare({ share }: { share: ShareModel }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div><h2 className="text-lg font-semibold text-gray-900 dark:text-white">Switchbook</h2><p className="text-sm text-gray-600 dark:text-gray-400">The mechanical keyboard switch database</p></div>
          <div className="flex items-center gap-3"><Link href="/auth/login" className="text-sm text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white">Sign In</Link><Link href="/auth/register" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Sign Up</Link></div>
        </div>
        <main className="overflow-hidden rounded-lg bg-white shadow-lg dark:bg-gray-800">
          <header className="border-b border-gray-200 p-6 dark:border-gray-700">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
              <div>
                <h1 data-testid="switch-name" className="flex flex-wrap items-center gap-3 text-2xl font-bold text-gray-900 dark:text-white">
                  {share.name}
                  {share.sourceKind === 'master' && <span data-testid="master-badge" title="Master Database Record" className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-purple-600 text-sm font-bold text-white">M</span>}
                  {share.isFranken && <span title="Franken switch" className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-500 text-sm font-bold text-white">F</span>}
                </h1>
                {share.chineseName && share.chineseName !== share.name && <p className="mt-1 text-lg text-gray-600 dark:text-gray-400">{share.chineseName}</p>}
                {share.attribution && <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{share.attribution}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {share.type && <span className={`rounded-full px-3 py-1 text-xs font-medium ${SWITCH_TYPE_COLORS[share.type as keyof typeof SWITCH_TYPE_COLORS] || 'bg-gray-100 text-gray-800'}`}>{share.type.replaceAll('_', ' ')}</span>}
                {share.technology && <span className={`rounded-full px-3 py-1 text-xs font-medium ${SWITCH_TECHNOLOGY_COLORS[share.technology as keyof typeof SWITCH_TECHNOLOGY_COLORS] || 'bg-gray-100 text-gray-800'}`}>{share.technology.replaceAll('_', ' ')}</span>}
              </div>
            </div>
          </header>
          <div className="grid gap-6 p-6 md:grid-cols-2">
            <CanonicalShareImage share={share} />
            <div className="space-y-6">
              {share.manufacturer && <section data-testid="manufacturer-stat"><h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">Details</h3><dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2"><div className="text-sm"><dt className="inline font-medium text-gray-700 dark:text-gray-300">Manufacturer: </dt><dd className="inline text-gray-600 dark:text-gray-400">{share.manufacturer}</dd></div></dl></section>}
              {share.sections.map(section => <section key={section.title}><h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">{section.title}</h3><dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">{section.stats.map(stat => <div key={stat.key} className="text-sm"><dt className="inline font-medium text-gray-700 dark:text-gray-300">{stat.label}: </dt><dd className="inline text-gray-600 dark:text-gray-400">{stat.value}</dd></div>)}</dl></section>)}
              {share.notes && <section><h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">Notes</h3><p className="whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-400">{share.notes}</p></section>}
              {(share.personalSections.length > 0 || share.personalNotes) && <section className="border-t border-gray-200 pt-5 dark:border-gray-700" data-testid="personal-details"><h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-blue-800 dark:text-blue-200">Personal Collection Details</h3>{share.personalSections.map(section => <dl key={section.title} className="grid grid-cols-1 gap-2 sm:grid-cols-2">{section.stats.map(stat => <div key={stat.key} className="text-sm"><dt className="inline font-medium text-gray-700 dark:text-gray-300">{stat.label}: </dt><dd className="inline text-gray-600 dark:text-gray-400">{stat.value}</dd></div>)}</dl>)}{share.personalNotes && <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20"><h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-800 dark:text-blue-200">Personal Notes</h4><p className="whitespace-pre-wrap text-sm text-blue-700 dark:text-blue-300">{share.personalNotes}</p></div>}</section>}
              <div className="space-y-2 border-t border-gray-200 pt-4 dark:border-gray-700"><ForceCurvesButton switchName={share.name} manufacturer={share.manufacturer || null} variant="button" className="w-full justify-center" isAuthenticated={false} /><SwitchScoresButton switchName={share.name} manufacturer={share.manufacturer || null} variant="button" className="w-full justify-center" /></div>
            </div>
          </div>
        </main>
        <div className="mt-8 rounded-lg bg-white p-6 text-center shadow dark:bg-gray-800"><h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">Want to track your own switch collection?</h3><p className="mb-4 text-sm text-gray-600 dark:text-gray-400">Join Switchbook to catalog switches, discover new ones, and share with the community.</p><Link href="/auth/register" className="inline-flex rounded-md bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700">Create Your Collection</Link></div>
      </div>
    </div>
  )
}
