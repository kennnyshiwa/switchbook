import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { findNextRankedIndex, rankForceCurveSuggestion } from '../src/lib/admin-force-curve-suggestions'
import { forceCurveAttachErrorMessage } from '../src/lib/admin-force-curve-attach-feedback'
import { catalogMasterCompatibility } from '../src/lib/admin-force-curves'

const catalog = { id: 'c1', displayName: 'Acer Yellow', repositoryPath: 'Acer Yellow/TG.csv', manufacturer: null, technology: null }
const master = (id: string, name: string, manufacturer: string | null = 'Acer', technology: string | null = 'MECHANICAL') => ({ id, name, manufacturer, technology })

test('rank assist returns one deterministic exact identity with explicit metadata warnings', () => {
  const result = rankForceCurveSuggestion(catalog, [master('m2', 'Other'), master('m1', 'Acer Yellow')])
  assert.equal(result?.master.id, 'm1')
  assert.equal(result?.tier, 'EXACT_UNIQUE')
  assert.deepEqual(result?.warnings, ['Manufacturer metadata is incomplete; verify the grouped source evidence.', 'Technology metadata is incomplete; verify the switch technology.'])
})

test('rank assist supports full-boundary identity but not loose threshold-80 token matches', () => {
  const source = { ...catalog, displayName: 'Acme Ocean Silent Dustproof curves', repositoryPath: 'Acme Ocean Silent Dustproof curves/TG.csv' }
  assert.equal(rankForceCurveSuggestion(source, [master('m1', 'Ocean Silent Dustproof', 'Acme')])?.tier, 'BOUNDARY_UNIQUE')
  assert.equal(rankForceCurveSuggestion(source, [master('m1', 'Ocean Silent')]), null)
})

test('BSUN Agarwood parent measurement rule accepts only numbered and actuation labels', () => {
  const bsun = { name: 'BSUN Agarwood', manufacturer: 'Bsun', technology: null }
  const known = [{ name: 'Bsun', aliases: ['BSUN'] }]
  for (const displayName of ['BSUN Agarwood 1', 'BSUN Agarwood 17', 'BSUN Agarwood 10k Actuations', 'BSUN Agarwood 100000 Actuations']) {
    assert.equal(catalogMasterCompatibility(bsun, { displayName, repositoryPath: `BSUN Agarwood/${displayName}.csv`, technology: null }, known).compatible, true, displayName)
  }
  for (const displayName of ['BSUN Agarwood Prototype', 'BSUN Agarwood 10k Revised', 'BSUN Agarwood 1 Other']) {
    assert.equal(catalogMasterCompatibility(bsun, { displayName, repositoryPath: `BSUN Agarwood/${displayName}.csv`, technology: null }, known).compatible, false, displayName)
  }
  assert.equal(catalogMasterCompatibility({ ...bsun, manufacturer: 'Other' }, { displayName: 'BSUN Agarwood 1', repositoryPath: 'BSUN Agarwood/curve.csv', technology: null }, known).compatible, false)
  assert.equal(catalogMasterCompatibility({ ...bsun, name: 'BSUN Agarwood Pro' }, { displayName: 'BSUN Agarwood 1', repositoryPath: 'BSUN Agarwood/curve.csv', technology: null }, known).compatible, false)
})

test('rank assist fails closed for ties and bounded-query overflow', () => {
  assert.equal(rankForceCurveSuggestion(catalog, [master('m1', 'Acer Yellow'), master('m2', 'Acer Yellow')]), null)
  assert.equal(rankForceCurveSuggestion(catalog, [master('m1', 'Acer Yellow')], true), null)
})

test('suggestion route is read-only and gates both admin access and the default-off server flag', () => {
  const route = readFileSync(new URL('../src/app/api/admin/force-curves/suggestions/route.ts', import.meta.url), 'utf8')
  assert.match(route, /session\?\.user\?\.role !== 'ADMIN'[\s\S]*status: 403/)
  assert.match(route, /process\.env\.FORCE_CURVE_RANK_ASSIST_ENABLED === 'true'/)
  assert.match(route, /if \(!enabled\(\)\) return NextResponse\.json\([\s\S]*status: 404/)
  assert.match(route, /export async function GET/)
  assert.doesNotMatch(route, /export async function (POST|PUT|PATCH|DELETE)|\.(create|update|delete|upsert)\s*\(/)
})

test('keyboard staging writes nothing, Escape always clears, and Enter confirms only a staged action', () => {
  const component = readFileSync(new URL('../src/components/admin/ForceCurveReviewQueue.tsx', import.meta.url), 'utf8')
  const escape = component.indexOf("if (event.key === 'Escape' && staged)")
  const controlGuard = component.indexOf("target?.closest('input, select, textarea, button, a")
  assert.ok(escape > 0 && escape < controlGuard, 'Escape cancellation must run before the form/dialog focus guard')
  assert.match(component, /if \(event\.key === 'Escape' && staged\) \{ event\.preventDefault\(\);[\s\S]*setStaged\(null\); return \}/)
  assert.match(component, /if \(staged && staged\.sourceKey === item\.sourceKey && event\.key === 'Enter'\) \{[\s\S]*confirmStaged\(item\)/)
  assert.match(component, /if \(kind\) \{ event\.preventDefault\(\); setStaged\([\s\S]*\) \}/)
  assert.doesNotMatch(component.slice(component.indexOf('const handler ='), component.indexOf('window.addEventListener')), /fetch\(|mutate\(|attachSuggestion\(/)
})

test('flag-off retains the original confidence label while flag-on avoids probability language', () => {
  const component = readFileSync(new URL('../src/components/admin/ForceCurveReviewQueue.tsx', import.meta.url), 'utf8')
  assert.match(component, /rankAssistEnabled \? `deterministic queue class \$\{item\.bucket\}` : `confidence \$\{Math\.round\(item\.confidence \* 100\)\}%`/)
})

test('enabled rank assist is discoverable when initial groups have no suggestion', () => {
  const component = readFileSync(new URL('../src/components/admin/ForceCurveReviewQueue.tsx', import.meta.url), 'utf8')
  assert.match(component, /data-testid="force-curve-rank-status"/)
  assert.match(component, /Rank assist enabled/)
  assert.match(component, /Find next suggestion/)
  assert.match(component, /No deterministic suggestion for this group\. Manual search remains available\./)
  assert.match(component, /Rank assist could not check this group\./)
})

test('find-next is bounded to the loaded page and suggestion cache follows catalog identity', () => {
  const component = readFileSync(new URL('../src/components/admin/ForceCurveReviewQueue.tsx', import.meta.url), 'utf8')
  assert.match(component, /findNextRankedIndex\(queue\.items, activeIndex, loadSuggestion\)/)
  assert.match(component, /const current = suggestions\[item\.sourceKey\][\s\S]*current\?\.catalogEntryId === catalog\.id/)
  assert.match(component, /status: 'error'[\s\S]*Retry/)
  const findNext = component.slice(component.indexOf('async function findNextSuggestion'), component.indexOf('async function refreshQueue'))
  assert.doesNotMatch(findNext, /method:\s*['"](POST|PUT|PATCH|DELETE)['"]/)
})

test('find-next discovers the first eligible group later on the loaded page', async () => {
  const visited: string[] = []
  const index = await findNextRankedIndex(['none-1', 'none-2', 'eligible', 'later'], 0, async item => {
    visited.push(item)
    return item === 'eligible' ? rankForceCurveSuggestion(catalog, [master('m1', 'Acer Yellow')]) : null
  })
  assert.equal(index, 2)
  assert.deepEqual(visited, ['none-1', 'none-2', 'eligible'])
})

test('find-next reports no suggestion after checking the bounded loaded page', async () => {
  const visited: number[] = []
  const index = await findNextRankedIndex([0, 1, 2], 1, async item => { visited.push(item); return null })
  assert.equal(index, null)
  assert.deepEqual(visited, [1, 2])
})

test('discoverability preserves keyboard focus and mobile-safe responsive layout', () => {
  const component = readFileSync(new URL('../src/components/admin/ForceCurveReviewQueue.tsx', import.meta.url), 'utf8')
  assert.match(component, /requestAnimationFrame\(\(\) => cardRefs\.current\[queue\.items\[index\]\.sourceKey\]\?\.focus\(\)\)/)
  assert.match(component, /flex flex-col gap-3[\s\S]*sm:flex-row sm:items-center sm:justify-between/)
  assert.match(component, /disabled=\{Boolean\(busy\) \|\| scanning\}/)
  const rankStatus = component.indexOf('data-testid="force-curve-rank-status"')
  const queueProgress = component.indexOf('aria-label="Queue progress"')
  const stickyFilters = component.indexOf('sticky top-0')
  assert.ok(rankStatus > 0 && rankStatus < queueProgress && queueProgress < stickyFilters, 'mobile rank heading and action must render before stats and filters')
})

test('rejected manual attachment stays actionable and persistent on its exact mobile card', () => {
  const component = readFileSync(new URL('../src/components/admin/ForceCurveReviewQueue.tsx', import.meta.url), 'utf8')
  assert.match(component, /useState<Record<string, AttachFeedback>>\(\{\}\)/)
  assert.match(component, /setAttachFeedback\(value => \(\{ \.\.\.value, \[item\.sourceKey\]: \{ status: 'loading'/)
  assert.match(component, /data-testid=\{`attach-feedback-\$\{item\.sourceKey\}`\}/)
  assert.match(component, /role=\{cardAttachFeedback\.status === 'error' \? 'alert' : 'status'\}/)
  assert.match(component, /break-words rounded-md border p-3 text-sm/)
  assert.match(component, /cardAttachFeedback\?\.status === 'loading' \? 'Attaching…'/)
  assert.doesNotMatch(component, /setChosenMaster\([^\n]+catch/)
  assert.doesNotMatch(component, /setOverrideAcknowledged\([^\n]+catch/)
  assert.doesNotMatch(component, /setOverrideReason\([^\n]+catch/)
  assert.equal(forceCurveAttachErrorMessage('APPROVED_MASTER_REQUIRED'), 'This MasterSwitch cannot be attached yet. Select an approved MasterSwitch with a manufacturer, then retry.')
  assert.equal(forceCurveAttachErrorMessage('REVIEW_CANDIDATE_REQUIRED'), 'This card does not contain a complete attachable source-review group. Review its evidence and select the exact catalog candidate.')
  assert.match(forceCurveAttachErrorMessage('INCOMPLETE_SOURCE_GROUP'), /Refresh this card/)
  assert.match(component, /refreshable: message === forceCurveAttachErrorMessage\('INCOMPLETE_SOURCE_GROUP'\)/)
  assert.match(component, /Refresh group and retry/)
})

test('manual attachment rejection preserves authorization and does not refresh or change skip/defer behavior', () => {
  const component = readFileSync(new URL('../src/components/admin/ForceCurveReviewQueue.tsx', import.meta.url), 'utf8')
  const chooseMaster = component.slice(component.indexOf('async function chooseMaster'), component.indexOf('async function attachSuggestion'))
  const rejected = chooseMaster.indexOf('if (!response.ok) throw')
  const optimisticSuccess = chooseMaster.indexOf('setQueue')
  const refresh = chooseMaster.indexOf('await refreshQueue()')
  const caught = chooseMaster.indexOf('} catch (e)')
  assert.ok(rejected > 0 && rejected < optimisticSuccess && optimisticSuccess < refresh && refresh < caught)
  assert.match(chooseMaster, /method: 'PUT'/)
  assert.doesNotMatch(chooseMaster.slice(caught), /setQueue|refreshQueue|method: 'POST'/)
  assert.match(component, /rankAssistEnabled \? `deterministic queue class/)
  assert.match(component, /Skip \/ defer/)
  const route = readFileSync(new URL('../src/app/api/admin/force-curves/reviews/route.ts', import.meta.url), 'utf8')
  assert.match(route, /mutationAccess\(request\)/)
  const service = readFileSync(new URL('../src/lib/admin-force-curves.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(service, /!master\.manufacturer\s*\|\|\s*!master\.technology/)
})
