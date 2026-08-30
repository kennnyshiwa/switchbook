import { FORCE_CURVE_SOURCE } from '@/lib/force-curves'

const GITHUB_ORIGIN = 'https://github.com'
const TRUSTED_REPOSITORIES = new Map([
  ['theremingoat/force-curves', 'ThereminGoat/force-curves'],
  ['aeboards/force-curves', 'AEBoards/force-curves'],
])

function repositoryFromSource(source?: string | null) {
  const repository = source?.match(/^github:(.+)$/)?.[1]
  return repository ? TRUSTED_REPOSITORIES.get(repository.toLowerCase()) || null : null
}

function safeRepositoryPath(repositoryPath?: string | null) {
  if (!repositoryPath || repositoryPath.includes('\\') || /[\u0000-\u001f\u007f]/.test(repositoryPath)) return null
  const segments = repositoryPath.split('/')
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) return null
  return segments.map(encodeURIComponent).join('/')
}

/** Builds a GitHub-only review target; incomplete or unsafe metadata falls back to the canonical repository. */
export function forceCurveReviewSourceLink(source?: string | null, repositoryPath?: string | null) {
  const canonicalRepository = FORCE_CURVE_SOURCE.slice('github:'.length)
  const sourceRepository = repositoryFromSource(source)
  const repository = sourceRepository || canonicalRepository
  const encodedPath = sourceRepository ? safeRepositoryPath(repositoryPath) : null
  return {
    publisher: repository.split('/')[0],
    href: encodedPath
      ? `${GITHUB_ORIGIN}/${repository}/blob/main/${encodedPath}`
      : `${GITHUB_ORIGIN}/${repository}`,
    exactFile: Boolean(encodedPath),
  }
}
