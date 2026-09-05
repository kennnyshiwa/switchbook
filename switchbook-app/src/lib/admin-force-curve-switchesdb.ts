const SWITCHES_DB_ORIGIN = 'https://switchesdb.switchbook.app/'
const THEREMINGOAT_SOURCE = 'github:ThereminGoat/force-curves'
const RAW_SUFFIX = ' Raw Data CSV.csv'
const HIGH_RESOLUTION_SUFFIX = '_HighResolutionRaw.csv'
const SWITCHES_DB_STRIPPED_CHARACTERS = /[$&+,:;=?@#|'<>^*%!]/g

export type SwitchesDBCandidate = {
  id: string
  source: string
  displayName: string
  repositoryPath: string
}

export type SwitchesDBResolution =
  | { available: true; key: string; url: string; label: string; candidateId: string; repositoryPath: string }
  | { available: false; reason: string }

function safePath(path: string) {
  if (!path || path.includes('\\') || /[\u0000-\u001f\u007f]/.test(path)) return false
  const segments = path.split('/')
  return segments.length >= 2 && segments.every(segment => Boolean(segment) && segment !== '.' && segment !== '..')
}

function fileName(path: string) {
  return path.slice(path.lastIndexOf('/') + 1)
}

function parentPath(path: string) {
  return path.slice(0, path.lastIndexOf('/'))
}

function measurementIdentity(path: string) {
  const file = fileName(path)
  const stem = file.endsWith(RAW_SUFFIX)
    ? file.slice(0, -RAW_SUFFIX.length)
    : file.endsWith(HIGH_RESOLUTION_SUFFIX)
      ? file.slice(0, -HIGH_RESOLUTION_SUFFIX.length).replace(/_/g, ' ')
      : null
  return stem === null ? null : `${parentPath(path)}\u0000${stem}`
}

/** Mirrors the exact ThereminGoat filename transform used by SwitchesDB's generator. */
export function switchesDBThereminGoatKey(repositoryPath: string) {
  if (!safePath(repositoryPath)) return null
  const rawFileName = fileName(repositoryPath)
  if (!rawFileName.endsWith(RAW_SUFFIX)) return null
  const key = rawFileName.replace(SWITCHES_DB_STRIPPED_CHARACTERS, '').replace(RAW_SUFFIX, '~TG.csv')
  return key && key !== '~TG.csv' ? key : null
}

/** Resolves one exact, SwitchesDB-loadable artifact from one sourceKey's candidate set. */
export function resolveSwitchesDBMeasurement(candidates: SwitchesDBCandidate[], primaryCandidateId?: string | null): SwitchesDBResolution {
  const candidatesById = new Map<string, SwitchesDBCandidate>()
  for (const candidate of candidates) {
    const existing = candidatesById.get(candidate.id)
    if (existing && (existing.source !== candidate.source || existing.repositoryPath !== candidate.repositoryPath || existing.displayName !== candidate.displayName)) {
      return { available: false, reason: 'SwitchesDB preview unavailable: the source candidate identity is inconsistent.' }
    }
    candidatesById.set(candidate.id, candidate)
  }
  const uniqueCandidates = [...candidatesById.values()]
  const primary = primaryCandidateId
    ? uniqueCandidates.find(candidate => candidate.id === primaryCandidateId)
    : uniqueCandidates.length === 1 ? uniqueCandidates[0] : undefined

  if (!primary) return { available: false, reason: 'SwitchesDB preview unavailable: the exact primary source file is missing or ambiguous.' }
  if (primary.source !== THEREMINGOAT_SOURCE) return { available: false, reason: 'SwitchesDB preview unavailable: this source repository is not supported.' }
  if (uniqueCandidates.some(candidate => candidate.source !== primary.source)) return { available: false, reason: 'SwitchesDB preview unavailable: this source group contains mixed repositories.' }
  if (!safePath(primary.repositoryPath)) return { available: false, reason: 'SwitchesDB preview unavailable: the exact repository path is unsafe.' }

  const identity = measurementIdentity(primary.repositoryPath)
  if (!identity) return { available: false, reason: 'SwitchesDB preview unavailable: this file format is not loadable.' }

  const rawMatches = uniqueCandidates.filter(candidate =>
    candidate.source === primary.source
    && safePath(candidate.repositoryPath)
    && candidate.repositoryPath.endsWith(RAW_SUFFIX)
    && measurementIdentity(candidate.repositoryPath) === identity
    && switchesDBThereminGoatKey(candidate.repositoryPath),
  )
  if (rawMatches.length !== 1) {
    return { available: false, reason: rawMatches.length
      ? 'SwitchesDB preview unavailable: more than one exact raw measurement matches this source.'
      : 'SwitchesDB preview unavailable: the exact loadable raw sibling is missing.' }
  }

  const raw = rawMatches[0]
  const key = switchesDBThereminGoatKey(raw.repositoryPath)!
  return {
    available: true,
    key,
    url: `${SWITCHES_DB_ORIGIN}#${encodeURIComponent(key)}`,
    label: primary.displayName || key.replace(/~TG\.csv$/, ''),
    candidateId: raw.id,
    repositoryPath: raw.repositoryPath,
  }
}
