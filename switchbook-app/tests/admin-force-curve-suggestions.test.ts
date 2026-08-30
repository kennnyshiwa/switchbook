import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { rankForceCurveSuggestion } from '../src/lib/admin-force-curve-suggestions'

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
