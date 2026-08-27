import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { fetchThereminGoatCatalog, forceCurveSyncRevision, syncForceCurveCatalog } from '@/lib/force-curves'
export async function POST() {
  const session = await auth(); if (session?.user?.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  const catalog = await fetchThereminGoatCatalog(); return NextResponse.json(await syncForceCurveCatalog(forceCurveSyncRevision(catalog.revision), catalog.entries, { catalogRevision: catalog.revision }))
}
