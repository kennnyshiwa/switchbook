import { prisma } from '@/lib/prisma'
import { rehostRemoteImage } from '@/lib/remote-image'
import { deleteFile } from '@/lib/local-storage'

export async function associateSubmissionPhotos(
  submissionId: string,
  masterSwitchId: string,
  photos: Array<{ url: string; alt: string; sourceUrl?: string; license?: string; attribution?: string }>,
  download: typeof rehostRemoteImage = rehostRemoteImage,
  removeUpload: typeof deleteFile = deleteFile,
) {
  for (const [index, photo] of photos.entries()) {
    const sourceUrl = photo.sourceUrl || photo.url
    let uploadedPath: string | undefined
    try {
      await prisma.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`partner-photo:${submissionId}:${sourceUrl}`}))`
        const job = await tx.partnerSubmissionPhoto.findUnique({ where: { submissionId_sourceUrl: { submissionId, sourceUrl } } })
        if (!job || job.status === 'SUCCEEDED') return
        const existing = await tx.switchImage.findFirst({ where: { masterSwitchId, sourceUrl } })
        if (existing) {
          await tx.partnerSubmissionPhoto.update({ where: { id: job.id }, data: { status: 'SUCCEEDED', error: null, switchImageId: existing.id } })
          return
        }
        const uploaded = await download(photo.url, `master-switches/${masterSwitchId}`)
        uploadedPath = uploaded.pathname
        const image = await tx.switchImage.create({ data: { masterSwitchId, url: uploaded.url, order: index, width: uploaded.width, height: uploaded.height, size: uploaded.size, checksumSha256: uploaded.checksumSha256, altText: photo.alt, sourceUrl, license: photo.license, attribution: photo.attribution } })
        await tx.partnerSubmissionPhoto.update({ where: { id: job.id }, data: { status: 'SUCCEEDED', error: null, switchImageId: image.id } })
      })
    } catch (error) {
      if (uploadedPath) await removeUpload(uploadedPath)
      const message = error instanceof Error ? error.message.slice(0, 500) : 'Image rejected'
      await prisma.partnerSubmissionPhoto.updateMany({ where: { submissionId, sourceUrl, status: { not: 'SUCCEEDED' } }, data: { status: 'FAILED', error: message } }).catch(() => undefined)
      console.warn('[partner-submission-image]', masterSwitchId, message)
    }
  }
}

export function photoOutcome(photos: Array<{ sourceUrl: string; status: string; error: string | null }>) {
  const processing = photos.some(photo => photo.status === 'PENDING' || photo.status === 'PROCESSING')
  return {
    photosStatus: processing ? 'processing' : 'complete',
    photos: photos.map(photo => ({ sourceUrl: photo.sourceUrl, status: photo.status.toLowerCase(), error: photo.error })),
  }
}
