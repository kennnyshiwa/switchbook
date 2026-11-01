import { z } from 'zod'

// References only: importing never reads a path or fetches a URL. Local paths
// must remain inside public uploads; remote references must be HTTP(S).
export function isImageReference(value: string): boolean {
  if (/^\/uploads\/[A-Za-z0-9_./-]+$/.test(value)) return !value.split('/').some(part => part === '.' || part === '..')
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
  } catch { return false }
}
export const imageReferenceUrl = z.string().refine(isImageReference, 'Use an HTTP(S) image URL or a public /uploads/ reference')
const nullableText = z.string().nullable().optional()
export const imageReferenceSchema = z.object({
  url: imageReferenceUrl,
  type: z.enum(['UPLOADED', 'LINKED']),
  order: z.number().int().min(0).max(2147483647),
  primary: z.boolean().optional(),
  caption: nullableText, altText: nullableText,
  remoteUrl: nullableText, sourceUrl: nullableText, sourceName: nullableText,
  license: nullableText, attribution: nullableText,
  width: z.number().int().nonnegative().max(2147483647).nullable().optional(),
  height: z.number().int().nonnegative().max(2147483647).nullable().optional(),
  size: z.number().int().nonnegative().max(2147483647).nullable().optional(),
}).strict()
// Do not impose the upload slot limit on legacy snapshots: no bytes are uploaded.
export const imageReferencesSchema = z.array(imageReferenceSchema).refine(
  images => images.filter(image => image.primary).length <= 1, 'A gallery can have only one primary image')
export const imageImportSchema = z.object({
  imageReferences: imageReferencesSchema.optional(),
  imageUrl: imageReferenceUrl.nullable().or(z.literal('')).optional(),
})
export type ImageReference = z.infer<typeof imageReferenceSchema>
export function exportImageReferences(record: { images?: readonly Record<string, unknown>[]; primaryImageId?: unknown }): ImageReference[] {
  return (record.images ?? []).map(image => imageReferenceSchema.parse({
    ...Object.fromEntries(['url', 'type', 'order', 'caption', 'altText', 'remoteUrl', 'sourceUrl', 'sourceName', 'license', 'attribution', 'width', 'height', 'size'].filter(key => image[key] !== undefined).map(key => [key, image[key]])),
    primary: image.id === record.primaryImageId,
  }))
}
export function imageReferenceCreates(images: ImageReference[]) {
  return images.map(({ primary: _primary, ...image }) => ({ ...image, id: crypto.randomUUID() }))
}
// IDs are generated server-side before insertion, so equal order/URL values
// cannot make primary selection depend on database return order.
export function primaryReferenceId(images: ImageReference[], creates: { id: string }[]): string | null {
  const index = images.findIndex(image => image.primary)
  return index < 0 ? null : creates[index].id
}
