# SWITCHBOOK-PERF-MASTERSWITCH-20260828-002

- State: implementing
- Owner: SwitchBook product/domain owner
- Target surface: `switchbook-app` production-equivalent and `https://switchbook.app`; force-curve review MasterSwitch attach flow, Master Switches, `/admin`, and `/admin/force-curves`.
- Intake released SHA: `a2f5442626d08ae8eda028f65389c81e65e957f2`.
- Objectives: fix authenticated ADMIN MasterSwitch selection/attach failure reporting `Same-origin request required`; materially improve evidenced navigation/load bottlenecks.
- Correctness truth: attach must persist the intended mapping and update the UI without reload; real cross-origin writes remain rejected; anonymous/non-admin access remains denied; diagnosis and QA must not accidentally mutate production data.
- Performance truth: capture cold/warm route timings plus server/API/query breakdown; repeatable warm transition p95 target `<1s`, relevant API/server response p95 `<750ms`, or concrete measured infrastructure bottleneck.
- Workflow: owner diagnosis and exact trace first; implementation/data work by configured `builder`; independent acceptance by `qa`; exact-SHA CI, Docker Compose release, and production checks by `ops`; research only for necessary primary-source evidence.
- Gates: `npx tsc --noEmit`, focused tests, full tests, lint, production build; regression coverage for attach/origin and identified query/performance issue.
- Production validation: reversible dedicated fixture only, with cleanup/reconciliation evidence; exact revision/digest, health, logs, live timing/attach flow, and rollback procedure.
- QA: fresh desktop/mobile authenticated ADMIN browser verification, attach success/persistence, access controls, before/after measurements, and `PASS_VERIFIED` or `FAIL_REWORK`.
- Iteration budget: maximum 3 builder/QA cycles; rewrite root cause if the same failure repeats twice.
- iOS parity: pending assessment; record N/A with reason if admin-only web behavior.
- Preserve: all unrelated dirty work present at intake.
- Required milestones: diagnosis, builder self-test, independent QA, CI, deployment, production QA.
- Final status constraint: `resolved_verified` or concrete blocker only.
- Confirmed attach root cause: released authenticated ADMIN invalid-body `PUT https://switchbook.app/api/admin/force-curves/reviews` with browser `Origin: https://switchbook.app` safely returned HTTP 403 before schema parsing. nginx forwards the public host/protocol, but Next standalone constructs `request.nextUrl.origin` as `https://0.0.0.0:3000` from container `HOSTNAME=0.0.0.0` and `PORT=3000`; direct equality rejects legitimate public-origin writes.
- Performance baseline: `/admin/force-curves` cold `11.859s`, warm p95 `11.271s`; reviews GET is `21,395,407` bytes with warm p95 `11.182s`, caused by unpaginated all-review/all-candidate loads, O(review×candidate) enrichment, full 2,729-item serialization despite rendering 100, and full refresh after mutation. `/admin/master-switches` cold spinner `2.311s`, warm visible p95 `3.139s`, with duplicate session and duplicate submission/edit request pairs; relevant API p95 `828.8ms`. `/admin` warm p95 `293.6ms` and is healthy.
- Diagnosis evidence: `diagnosis-builder-readonly.md`; no mutation occurred. iOS parity is N/A because these are authenticated admin-only web routes.
- Builder implementation iteration 1: pending configured `builder`; must preserve strict CSRF/access control, paginate/filter/project the force-curve queue, avoid full refresh on attach, remove duplicate master-switches loading, add regression/performance-query tests, and run all required gates.

## Intake dirty-work snapshot

Captured before task changes in `intake-git-status.txt`; all entries are out of scope and must be preserved.

## Ledger

- 2026-08-28 diagnosis milestone: exact production-safe request trace and cold/warm performance baselines completed by configured builder in read-only phase 0 and accepted by owner. Root cause is confirmed; implementation is authorized for builder iteration 1.
