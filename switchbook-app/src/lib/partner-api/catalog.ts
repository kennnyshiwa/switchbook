import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { apiOrigin, switchesDbSearchUrl } from './config'

export const partnerSwitchInclude = {
  images: { orderBy: { order: 'asc' as const } },
  lifecycle: true,
} satisfies Prisma.MasterSwitchInclude

export type PartnerSwitchRecord = Prisma.MasterSwitchGetPayload<{ include: typeof partnerSwitchInclude }>

export function catalogDisposition(status: string, lifecycle?: { status: string; catalogApprovedAt: Date } | null) {
  if (lifecycle?.status === 'MERGED' || lifecycle?.status === 'REMOVED') return lifecycle.catalogApprovedAt ? lifecycle.status : 'NOT_FOUND'
  return status === 'APPROVED' ? 'ACTIVE' : 'NOT_FOUND'
}

const absoluteUrl = (path: string) => path.startsWith('http') ? path : `${apiOrigin()}${path.startsWith('/') ? '' : '/'}${path}`

export async function toPartnerSwitch(record: PartnerSwitchRecord) {
  const curve = await prisma.forceCurveCache.findFirst({
    where: { switchName: record.name, manufacturer: record.manufacturer || null, hasForceCurve: true },
    select: { hasForceCurve: true, updatedAt: true },
  })
  const lifecycle = record.lifecycle?.status || 'ACTIVE'
  const images = record.images.map(image => ({
    id: image.id,
    url: absoluteUrl(image.url),
    alt: image.altText || image.caption || `${record.manufacturer ? `${record.manufacturer} ` : ''}${record.name}`,
    width: image.width,
    height: image.height,
    bytes: image.size,
    checksumSha256: image.checksumSha256,
    revision: image.revision,
    source: image.sourceName || 'SwitchBook',
    sourceUrl: image.sourceUrl,
    license: image.license,
    attribution: image.attribution || 'Data and photo from SwitchBook',
    updatedAt: image.uploadedAt.toISOString(),
  }))
  return {
    id: record.id,
    status: lifecycle,
    mergedIntoId: record.lifecycle?.mergedIntoId || null,
    name: record.name,
    chineseName: record.chineseName,
    manufacturer: record.manufacturer,
    type: record.type,
    technology: record.technology,
    forces: {
      initialGf: record.initialForce,
      actuationGf: record.actuationForce,
      tactileGf: record.tactileForce,
      bottomOutGf: record.bottomOutForce,
    },
    travel: { preMm: record.preTravel, totalMm: record.bottomOut, tactilePositionMm: record.tactilePosition },
    materials: { topHousing: record.topHousing, bottomHousing: record.bottomHousing, stem: record.stem },
    colors: { topHousing: record.topHousingColor, bottomHousing: record.bottomHousingColor, stem: record.stemColor },
    stemShape: record.stemShape,
    spring: {
      weight: record.springWeight,
      length: record.springLength,
      progressive: record.progressiveSpring,
      stages: record.doubleStage ? 2 : 1,
    },
    magnetic: record.technology === 'MAGNETIC' ? {
      orientation: record.magnetOrientation,
      position: record.magnetPosition,
      polarity: record.magnetPolarity,
      initialFluxGs: record.initialMagneticFlux,
      bottomOutFluxGs: record.bottomOutMagneticFlux,
      pcbThickness: record.pcbThickness,
    } : null,
    clickType: record.clickType,
    markings: record.markings,
    compatibility: record.compatibility,
    notes: record.notes,
    images,
    thumbnail: images[0]?.url || record.imageUrl && absoluteUrl(record.imageUrl) || null,
    forceCurve: curve ? {
      available: true,
      url: switchesDbSearchUrl(record.name, record.manufacturer),
      source: 'SwitchesDB',
      rawDataIncluded: false,
      checkedAt: curve.updatedAt.toISOString(),
    } : { available: false, url: null, source: 'SwitchesDB', rawDataIncluded: false, checkedAt: null },
    recordUrl: `${apiOrigin()}/switches/${record.id}`,
    attribution: { text: 'Data and photo from SwitchBook', url: `${apiOrigin()}/switches/${record.id}` },
    version: record.version,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

export function lightweight(record: Awaited<ReturnType<typeof toPartnerSwitch>>) {
  return {
    id: record.id, status: record.status, mergedIntoId: record.mergedIntoId,
    name: record.name, manufacturer: record.manufacturer, type: record.type,
    technology: record.technology, thumbnail: record.thumbnail, recordUrl: record.recordUrl,
    updatedAt: record.updatedAt,
  }
}
