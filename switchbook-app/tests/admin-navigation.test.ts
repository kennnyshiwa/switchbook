import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { forceCurveReviewFailureStatus } from '../src/lib/admin-force-curve-attach-feedback'

test('admin dashboard exposes an accessible force curve review control', () => {
  const source = readFileSync(new URL('../src/app/admin/page.tsx', import.meta.url), 'utf8')

  assert.match(source, /href="\/admin\/force-curves"/)
  assert.match(source, />Force Curve Review Queue<\/h3>/)
  assert.match(source, /focus-visible:ring-2/)
  assert.match(source, /dark:bg-gray-800/)
  assert.match(source, /dark:text-white/)
})

test('master switch admin loading is single-shot and APIs are bounded projections', () => {
  const page = readFileSync(new URL('../src/app/admin/master-switches/page.tsx', import.meta.url), 'utf8')
  const providers = readFileSync(new URL('../src/components/Providers.tsx', import.meta.url), 'utf8')
  const submissions = readFileSync(new URL('../src/app/api/admin/master-switches/route.ts', import.meta.url), 'utf8')
  const edits = readFileSync(new URL('../src/app/api/admin/master-switch-edits/route.ts', import.meta.url), 'utf8')
  assert.match(page, /loadedFilter\.current === filter/)
  assert.match(page, /loadedFilter\.current = filter/)
  assert.doesNotMatch(page, /useSession/)
  assert.match(providers, /SessionProvider session=\{session\} refetchOnWindowFocus=\{false\}/)
  assert.match(providers, /fetch\('\/api\/auth\/session', \{ cache: 'no-store' \}\)/)
  assert.match(page, /loadAdminMasterSwitchData\(filter\)/)
  assert.match(submissions, /select:\s*\{/)
  assert.match(edits, /select:\s*\{/)
  assert.match(submissions, /take: 100/)
  assert.match(edits, /take: 100/)
})

test('force curve UI pages and refreshes a bounded server-side queue', () => {
  const source = readFileSync(new URL('../src/components/admin/ForceCurveReviewQueue.tsx', import.meta.url), 'utf8')
  const attachFeedback = readFileSync(new URL('../src/lib/admin-force-curve-attach-feedback.ts', import.meta.url), 'utf8')
  assert.match(source, /pageSize/)
  assert.match(source, /queue\.pagination\.hasNext/)
  assert.match(source, /refreshQueue\(queue\.pagination\.page/)
  assert.doesNotMatch(source, /visibleLimit/)
  assert.match(source, /catalogEntryId=/)
  assert.doesNotMatch(source, /disabled=\{!m\.compatibility\?\.compatible\}/)
  assert.match(source, /Results with identity warnings remain selectable/)
  assert.match(source, /compatibilityOverride/)
  assert.match(source, /overrideAcknowledged/)
  assert.match(source, /Audit reason/)
  assert.match(source, /onSubmit=\{event => \{ event\.preventDefault\(\); void findMasters\(item\) \}\}/)
  assert.match(source, /masterQuery\[item\.sourceKey\] \?\? catalog\?\.displayName/)
  assert.match(attachFeedback, /That MasterSwitch does not exactly match this catalog switch/)
  assert.match(source, /MasterSwitch attached successfully, but the queue refresh timed out/)
  assert.match(source, /window\.setTimeout\(\(\) => timeout\.abort\(\), 15_000\)/)
  assert.match(attachFeedback, /does not contain a complete attachable source-review group/)
  assert.match(attachFeedback, /This source group is incomplete or changed/)
  assert.match(source, /target="_blank" rel="noopener noreferrer"/)
  assert.match(source, /View source on GitHub/)
  assert.match(source, /min-h-11/)
  assert.match(source, /aria-label=\{`Open \$\{sourceLink\.publisher\}/)
  assert.doesNotMatch(source, /View source on GitHub[^<]+onClick=/)
})

test('force curve compatibility overrides are explicit, validated, and audited server-side', () => {
  const route = readFileSync(new URL('../src/app/api/admin/force-curves/reviews/route.ts', import.meta.url), 'utf8')
  const service = readFileSync(new URL('../src/lib/admin-force-curves.ts', import.meta.url), 'utf8')

  assert.match(route, /acknowledged:z\.literal\(true\)/)
  assert.match(route, /reason:z\.string\(\)\.trim\(\)\.min\(3\)\.max\(1000\)/)
  assert.match(route, /mutationAccess\(request\)/)
  assert.match(service, /if\(!selectedCompatibility\?\.compatible&&!overrideRequested\) throw new Error\('INCOMPATIBLE_IDENTITY'\)/)
  assert.match(service, /compatibilityReason:selectedCompatibility\?\.reason/)
  assert.match(service, /actorId:input\.actorId/)
  assert.match(service, /repositoryPath:entry\.repositoryPath,revision:entry\.revision,contentHash:entry\.contentHash/)
  assert.match(service, /state:'AUTO_APPROVED',catalogEntryId:\{not:candidate\.id\}/)
  assert.match(service, /Superseded by explicit reviewed source attachment/)
})

test('force curve review failures preserve truthful terminal, stale, and validation responses', () => {
  assert.equal(forceCurveReviewFailureStatus('ATTACHED_REVIEW_IMMUTABLE'), 409)
  assert.equal(forceCurveReviewFailureStatus('ATTACH_REPLAY_MISMATCH'), 409)
  assert.equal(forceCurveReviewFailureStatus('INCOMPLETE_SOURCE_GROUP'), 409)
  assert.equal(forceCurveReviewFailureStatus('OPEN_SOURCE_REVIEW_REQUIRED'), 404)
  assert.equal(forceCurveReviewFailureStatus('OPEN_REVIEW_REQUIRED'), 404)
  assert.equal(forceCurveReviewFailureStatus('REVIEW_CANDIDATE_REQUIRED'), 400)
  assert.equal(forceCurveReviewFailureStatus('APPROVED_MASTER_REQUIRED'), 400)
})
