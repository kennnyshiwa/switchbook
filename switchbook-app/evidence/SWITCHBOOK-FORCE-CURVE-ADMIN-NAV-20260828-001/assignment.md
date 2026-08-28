# SWITCHBOOK-FORCE-CURVE-ADMIN-NAV-20260828-001

- State: diagnosed; builder dispatched
- Owner: SwitchBook domain owner
- Target: `switchbook-app`, production `https://switchbook.app`
- Objective: ship one production fix that adds a visible `/admin` control for `/admin/force-curves` and brings the force-curve review queue into visual/theme parity with canonical SwitchBook admin/app surfaces.
- Root cause: `/admin/page.tsx` has no link to `/admin/force-curves`; the review page and `ForceCurveReviewQueue` were introduced with compressed one-off markup and incomplete light/dark utility pairings, so inherited dark-mode text, borders, inputs, badges, sticky surfaces, responsive hierarchy, and interaction states do not match the established admin dashboard.
- Reproduction evidence: source audit on 2026-08-28 confirms the admin action grid ends with `/admin/master-switches` and contains no force-curves route; `src/app/admin/force-curves/page.tsx` is a bare `<main>`; queue controls/cards use unpaired classes including `bg-white dark:bg-gray-950`, `text-gray-600`, `border`, and light-only badge/action colors.
- Acceptance: clearly labeled and correctly grouped admin control, legible/tappable desktop and mobile, navigation without typed URL; native/readable/usable force-curves UI on desktop and mobile; parity for typography, colors/contrast, cards, spacing, controls, badges/status, responsive behavior, loading/empty/error/focus/hover states; non-admin authorization unchanged; typecheck, tests, lint, build; independent browser QA with screenshots and reference comparison; green CI; Compose-only deployment; exact SHA/image, health/readiness/log and rollback evidence; authenticated production QA on desktop/mobile plus non-admin denial.
- Iteration budget: 3 builder/QA cycles; repeated failure requires root-cause rewrite.
- Evidence required: builder validation; independent QA verdict and screenshots; CI run; deployment/rollback record; production desktop/mobile/admin/non-admin QA.
- Preserve: all unrelated dirty changes listed by `git status` at intake.
- Next action: builder implements iteration 1 and returns self-test evidence.
