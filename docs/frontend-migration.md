# Frontend replacement inventory: `frontend/` → `new-frontend/`

## Evidence scope and provenance

This is a read-only comparison of the preserved pre-replacement tree at
[`frontend-prev/`](../frontend-prev/) and the approved target snapshot stored in
`new-frontend-git-backup` at commit `ad66e054216fa17d84e2d4080e16bb058cb23caf`.
The requested `new-frontend/` checkout directory is absent; target-side source
citations below use its logical `new-frontend/...` paths and line numbers from
that exact commit. Reproduce a target citation with
`git --git-dir=new-frontend-git-backup show ad66e054:<path-inside-target> | nl -ba`.
The current `frontend/` has already been partially changed and is not the
pre-replacement baseline used for this inventory. No source files were changed
as part of this discovery continuation. Claims that cannot be proven from the
preserved tree, target commit, or backend are marked **unverified**.

Legend for the status column:

| Marker | Meaning |
| --- | --- |
| `same` | Present in both with the same observable contract |
| `changed` | Present in both, but the implementation/contract differs |
| `missing-in-new` | Present in `frontend/`, absent from `new-frontend/` |
| `new-only` | Present only in `new-frontend/` |

> Scope note: this document is Step 1 of the replacement task. It records the
> pre-change state only. Anything dropped on purpose during Step 2 is appended
> to §9 with a reason.

---

## 1. Route inventory

Route declarations come from [`frontend-prev/src/App.tsx:104-141`](../frontend-prev/src/App.tsx#L104)
and the target snapshot source `new-frontend-git-backup@ad66e054:src/App.tsx:130-230`.

| # | Route | `frontend/` | `new-frontend/` | Status |
| --- | --- | --- | --- | --- |
| 1 | `/` | `LandingPage` [App.tsx:104](../frontend/src/App.tsx#L104) | `LandingPage` [App.tsx:187](../new-frontend/src/App.tsx#L187) | same |
| 2 | `/about` | `AboutPage` :105 | `AboutPage` :188 | same |
| 3 | `/contact` | `ContactPage` :106 | `ContactPage` :189 | same |
| 4 | `/privacy` | `PrivacyPage` :107 | `PrivacyPage` :190 | same |
| 5 | `/terms` | `TermsPage` :108 | `TermsPage` :191 | same |
| 6 | `*` (catch-all) | `NotFound` :141 | `NotFoundPage` :192 (inside `PublicLayout`) | changed (layout wrapper) |
| 7 | `/login` | `AuthPage` + `GuestOnly` :109 | `LoginPage` + `GuestOnly` :196 | changed (page module) |
| 8 | `/register` | `AuthPage` + `GuestOnly` :110 | `RegisterPage` + `GuestOnly` :197 | changed (page module) |
| 9 | `/forgot-password` | :112 | :198 | same |
| 10 | `/reset-password` | :113 | :199 | same |
| 11 | `/interviews/shared/:token` | `SharedReportPage` :115 | `SharedReportPage` :202 | same |
| 12 | `/dashboard` | `RequireAuth` :118 | app layout branch :212 | same path |
| 13 | `/interviews` | `InterviewsPage` :119 | `InterviewHistoryPage` :213 | same path, changed page module |
| 14 | `/interviews/new` | :120 | :214 | same |
| 15 | `/interviews/resumable` | :121 | :215 | same |
| 16 | `/interviews/:id/lobby` | :122 | :217 | same |
| 17 | `/interviews/:id/live` | :123 | :218 | same |
| 18 | `/interviews/:id/completed` | :124 | :219 | same |
| 19 | `/interviews/:id` | `InterviewDetailPage` :125 | `InterviewDetailPage` :216 | same |
| 20 | `/interviews/:id/history` | `InterviewTimelinePage` :126 | `TimelinePage` :220 | same path, changed page module |
| 21 | `/interviews/:id/metrics` | :127 | :221 | same |
| 22 | `/interviews/:id/report` | :128 | :222 | same |
| 23 | `/analytics` | :129 | :223 | same |
| 24 | `/profile` | :130 | :224 | same |
| 25 | `/settings` | :131 | :225 | same |
| 26 | `/settings/sessions` | :132 | :226 | same |
| 27 | `/admin` | `RequireAdmin` :135 | `RequireAdmin` :227 | same |
| 28 | `/admin/users` | `RequireAdmin` :136 | `RequireAdmin` :228 | same |
| 29 | `/admin/interviews` | `RequireAdmin` :137 | `RequireAdmin` :229 | same |
| 30 | `/admin/interviews/:id/report` | `RequireAdmin minRole="admin"` :139 | `RequireAdmin` :230 | changed (role-minimum no longer declared at the route) |

**No route is missing in `new-frontend/` and no route is new-only.** All 30
paths survive; six of them resolve to a different page module.

### Page module path changes

| `frontend/src/pages/...` | `new-frontend/src/pages/...` | Status |
| --- | --- | --- |
| `auth/auth.tsx` | `components/auth/auth-page.tsx` (imported by `auth/login.tsx:1`, `auth/register.tsx:1`) | changed |
| `auth/login.tsx`, `auth/register.tsx` | `auth/login.tsx:1`, `auth/register.tsx:1` (thin wrappers) | changed |
| `auth/password-checklist.tsx` | — | missing-in-new (component, not a route) |
| `admin/overview.tsx` | `admin/index.tsx:1` | changed |
| `admin/shared.tsx` | — (helpers inlined) | missing-in-new (module) |
| `interviews/shared.tsx` | — | missing-in-new (module) |
| `settings.tsx` | `settings/index.tsx` | changed |
| `sessions.tsx` | `settings/sessions.tsx` | changed |
| — | `not-found.tsx` | new-only |
| — | `settings/` directory split | new-only |

---

## 2. Feature parity

"present" = the feature is wired to the real service/socket; "partial" = UI
exists but a required call, guard or backend contract is absent; "absent" =
no implementation.

| Feature | Status in `new-frontend/` | Implementing file(s) |
| --- | --- | --- |
| Auth — login | present | `src/pages/auth/login.tsx:1` → `src/components/auth/auth-page.tsx:130`; `src/lib/services/auth.ts:24` |
| Auth — register | present | `src/pages/auth/register.tsx:1` → `auth-page.tsx:216`; `auth.ts:18` |
| Auth — verify OTP | present | `auth-page.tsx:328`; `auth.ts:21` |
| Auth — forgot password | present | `src/pages/auth/forgot-password.tsx:18`; `auth.ts:45` |
| Auth — reset password | present | `src/pages/auth/reset-password.tsx:24`; `auth.ts:48` |
| Auth — account recovery (`/auth/recover-account*`) | absent | no caller anywhere in `new-frontend/src` |
| Auth — email update (`/usr/update-email*`) | absent | no caller |
| Auth — sessions list / revoke one / revoke all | present | `src/pages/settings/sessions.tsx:25,29`; `auth.ts:36,39,42` |
| Auth — logout, me, refresh | present | `auth.ts:27,30,33`; `src/lib/http.ts:147` |
| Interview wizard | present | `src/pages/interviews/new.tsx:103` → `src/lib/services/interviews.ts:321` |
| Wizard — **scheduling a future date** | **absent** | no `isScheduled`/`scheduledDate` field is sent; `interviews.ts:321-332` builds the body without them. Backend accepts both (`backend/src/modules/interview/services/interview.service.ts:167-168,216-217`) |
| Wizard — ending criteria / question count | absent | draft has `durationMinutes`, `rounds` only (`types.ts:201-212`); `EndingCriteria` not modelled |
| Lobby | present | `src/pages/interviews/lobby.tsx:40` (fetches interview); start flow via `interviewService.start` (`interviews.ts:343`) |
| Live room — timer | partial | `src/pages/interviews/live.tsx:58-61` runs a **local** `setInterval`; it is not seeded from `interview:joined.timerStartedAt` (`use-interview-socket.ts:92-94` discards the payload) |
| Live room — pause / resume | partial | UI toggle only: `live.tsx:33`, `room-parts.tsx:218-222`. Never calls `POST /interviews/:id/pause` or `/resume` (`interviews.ts` has no such method) |
| Live room — end dialog | partial | `live.tsx:239-258`; the confirm button only `navigate()`s to `/completed` — it does **not** call `end()` or emit `interview:end` |
| Live room — skip | present (client-side only) | `live.tsx:136` submits the literal `'(skipped)'` as an answer |
| Live room — **code panel** | **absent** | no `CodeAnswerPanel`, no editor dependency (`new-frontend/package.json:13-39` has no CodeMirror/Monaco); `QuestionPanel` renders a textarea for every non-MCQ kind (`question-panel.tsx:156-185`) |
| Resumable page | present | `src/pages/interviews/resumable.tsx:17`; `interviews.ts:112` |
| History / list page | present | `src/pages/interviews/history.tsx:31`; `interviews.ts:64` |
| Interview detail | present | `src/pages/interviews/detail.tsx:29,34` |
| Report (owner) | present | `src/pages/interviews/report.tsx:15,20`; `interviews.ts:140` |
| Report — share link create/revoke | present | `interviews.ts:355,359` |
| Shared report | present | `src/pages/interviews/shared-report.tsx:17,22`; `interviews.ts:253,103` |
| Dashboard | present | `src/pages/dashboard.tsx:39,44` |
| Metrics page | partial | `src/pages/interviews/metrics.tsx:19,24` uses `get(id)` + `report(id)`; **`GET /interviews/:id/metrics` is never called** |
| Timeline page | present | `src/pages/interviews/timeline.tsx:20,25` |
| Analytics | present | `src/pages/analytics.tsx` via `analytics.ts:39,44` |
| Settings — account / preferences / notifications / security tabs | partial | `src/pages/settings/index.tsx:144-320`. Theme + motion persist (`:46-47`); interview defaults, notification toggles and password change are **local state + toast only** (`:242,274,299`) |
| Settings — "prototype role" switch | mock | `settings/index.tsx:118-140` explicitly says "This build ships with mock auth" |
| Notifications (bell) | present | `src/components/notification-bell.tsx`; `src/lib/stores/ui-store.ts:32-59`; `notifications.ts:4-13` |
| Admin — overview | partial | `src/pages/admin/index.tsx:17-19` calls `GET /admin/overview` with **no query**, backend defaults `period=30d` (`backend/src/modules/admin/zodschemas/admin.zschema.ts:89-91`) |
| Admin — users | partial | `src/pages/admin/users.tsx:38-57`; role mutation body is `{ role }` (`admin.ts:20-21`) but backend validates `{ newRole }` (`admin.zschema.ts:52-54`) |
| Admin — interviews list | present | `src/pages/admin/interviews.tsx:29` → **but** `admin.ts` exposes no `interviews()` method; see §3 of `docs/frontend-backend-gaps.md` |
| Admin — interview report | partial | `src/pages/admin/interview-report.tsx:21,26` calls the *owner* `GET /interviews/:id/report`, not `GET /admin/interviews/:id` |
| PDF export (report) | present but simplified | `src/components/report-view.tsx:35-49` (html2canvas + jsPDF); no code block |

---

## 3. "Must survive" checklist

These are the behaviours the task declares as shipped and non-negotiable.

| # | Item | Old location | In `new-frontend/`? | Evidence |
| --- | --- | --- | --- | --- |
| 1 | Code-answer input panel | `frontend/src/components/interview-room/code-answer-panel.tsx` | **missing-in-new** | no `code-answer-panel` file; `rg` over `new-frontend/src` returns nothing |
| 2 | Code editor (CodeMirror) | `frontend/src/components/interview-room/code-editor.tsx` (+ 6 `@codemirror/*` deps) | **missing-in-new** | `new-frontend/package.json:13-39` lists no `@codemirror/*` |
| 3 | `AnswerDisplay` code block + "Code was reviewed, not executed" | `frontend/src/components/interview-ui.tsx` | **missing-in-new** | `AnswerDisplay` not referenced anywhere under `new-frontend/src` |
| 4 | `hooks/use-answer-draft.ts` | `frontend/src/hooks/use-answer-draft.ts` | **missing-in-new** | no equivalent file; `QuestionPanel` holds raw `useState` (`question-panel.tsx:49-59`) |
| 5 | `submitCode` / `code:submit` in the socket hook | `frontend/src/hooks/use-interview-socket.ts` | **missing-in-new** | new hook emits only `interview:join`, `interview:leave`, `answer:submit`, `question:next`, `interview:cancel` (`use-interview-socket.ts:81,145,161,168,173`) |
| 6 | Code block in `lib/pdf-export.ts` | `frontend/src/lib/pdf-export.ts` | **missing-in-new** | no `pdf-export.ts`; export path is `report-view.tsx:35-49` |
| 7 | Kind mapping from `payload.answerFormat` | `frontend/src/lib/api.ts:103-111`, history normalizer | **missing-in-new** | `interviews.ts:117-137` maps only `questionType`; `answerFormat`/`answerLanguage` are never read |
| 8 | Auth recovery in the socket hook | `frontend/src/hooks/use-interview-socket.ts:211` (`connect_error` handler) | **partial** | new hook has `connect_error` but it only flips state to `offline` (`use-interview-socket.ts:88-90`); no re-auth/refresh retry |
| 9 | Tests under `src/__tests__/` | 60 files (`frontend/src/__tests__/**`) | **missing-in-new** | `new-frontend/src` contains no `__tests__` directory |

Backend counterparts that the above depend on (unchanged in this task):

- `code:submit` handler — `backend/src/websocket/interview.gateway.ts:324-360`
- `answer:submit` handler — `backend/src/websocket/interview.gateway.ts:294-317`
- `answerLanguage` column — `backend/src/modules/interview/schemas/answers.schema.ts:43`
- shared report code fields — `backend/src/modules/interview/services/interview.service.ts:2059-2062`

---

## 4. Environment, deployment and build/test configuration

### 4.1 Environment variables

| Variable | `frontend/` | `new-frontend/` | Status |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | `.env.example:2` | `src/lib/env.ts:1,6` (hard failure if unset) | same |
| `VITE_SOCKET_URL` | `.env.example:3` | `env.ts:2,20` (falls back to `apiBaseUrl`) | changed (new default) |
| `VITE_SOCKET_PATH` | `.env.example:4` | `env.ts:21` (defaults `/socket.io`) | same |
| `VITE_API_VERSION` | `.env.example:5` | `env.ts:22` (defaults `api/v1`) | same |
| `VITE_HEALTH_CHECK_INTERVAL_SECONDS` | `.env.example:7` | `env.ts:4,10-16` (0 disables, min 5) | changed (new clamping) |
| `.env.example` file itself | present | **missing-in-new** | `new-frontend/.env` exists but is not committed as an example |

Both roots carry a real `.env`; neither is a source file and neither is part of
the replacement.

### 4.2 `vercel.json`

| | `frontend/` | `new-frontend/` |
| --- | --- | --- |
| File | present — `framework: vite`, `buildCommand: npm run build`, `outputDirectory: dist`, SPA rewrite `/(.*) → /index.html` | **missing-in-new** |

Status: **missing-in-new**. Without it Vercel falls back to framework auto-detect
and the SPA rewrite, which would break deep links such as
`/interviews/:id/report`.

### 4.3 Vite config

| | `frontend/vite.config.ts` | `new-frontend/vite.config.ts` |
| --- | --- | --- |
| Plugins | `react()`, `tailwindcss()` :4-7 | `react()`, `tailwindcss()` :6-7 |
| Alias | `@` → `./src` via `__dirname` :11-13 | `@` → `./src` via `import.meta.dirname` :10 |
| Dev proxy | none | `/api`, `/socket.io` (ws), `/ready` → `http://localhost:4000` :18-31 |
| Dev port | default 5173 | `5174` :17 |
| `optimizeDeps` | none | `include: ['recharts']` :13-15 |

Status: **changed**.

### 4.4 npm scripts

| Script | `frontend/package.json` | `new-frontend/package.json` | Status |
| --- | --- | --- | --- |
| `dev` | `vite` :7 | `vite` :7 | same |
| `build` | `tsc -p tsconfig.check.json && vite build` :8 | `tsc --noEmit && vite build` :8 | changed |
| `preview` | `vite preview` :9 | `vite preview --port 4173` :11 | changed |
| `lint` | `eslint . --report-unused-disable-directives` :10 | `eslint .` :10 | changed |
| `typecheck` | — | `tsc --noEmit` :9 | new-only |
| `test`, `test:watch`, `test:ui`, `test:coverage` | :11-14 | — | missing-in-new |
| `test:lean`, `test:unit`, `test:integration` | :15-17 | — | missing-in-new |
| `test:e2e`, `test:e2e:headed`, `test:e2e:ui` | :18-20 | — | missing-in-new |

### 4.5 Test setup

| Artefact | `frontend/` | `new-frontend/` | Status |
| --- | --- | --- | --- |
| `vitest.config.ts` | present | — | missing-in-new |
| `vitest.config.unit.ts` / `vitest.config.integration.ts` | referenced by scripts :16-17 | — | missing-in-new |
| `vitest.setup.ts` | present | — | missing-in-new |
| `playwright.config.ts` | present | — | missing-in-new |
| `tsconfig.check.json` (build typecheck excluding tests) | present | — | missing-in-new |
| Unit/integration/system tests | 60 files under `src/__tests__/` | 0 | missing-in-new |
| E2E specs | 7 files under `e2e/` | 0 | missing-in-new |
| `@vitest/*`, `@testing-library/*`, `jsdom`, `msw`, `@playwright/test` | devDependencies :56-71 | absent | missing-in-new |

### 4.6 Lockfiles

| | `frontend/` | `new-frontend/` |
| --- | --- | --- |
| `package-lock.json` | present (325 KB) | present (213 KB) |
| `pnpm-lock.yaml` / `yarn.lock` | none | none |

Status: `same` kind, but the new lockfile predates the current
`new-frontend/package.json` dependency set and must be regenerated after the
merge (Step 2 requirement: "Commit a `package-lock.json`").

---

## 5. Dependencies

Full manifests: [`frontend/package.json:22-77`](../frontend/package.json#L22) and
[`new-frontend/package.json:13-57`](../new-frontend/package.json#L13).

### 5.1 In `frontend/` only — would be dropped by a naive replacement

| Package | Why it matters |
| --- | --- |
| `@codemirror/commands`, `-lang-javascript`, `-lang-python`, `-language`, `-state`, `-view` (:24-29) | the code editor (must-survive item 2) |
| `@base-ui/react` (:23) | used by existing UI primitives |
| `jspdf` ^4.2.1 vs new ^2.5.2 (:42) | **downgrade** if replaced |
| `recharts` ^3.10.1 vs new ^2.15.1 (:47) | **major downgrade** if replaced |
| `@playwright/test` (:56) | e2e |
| `@testing-library/jest-dom`, `-react`, `-user-event` (:58-60) | unit/integration |
| `@vitest/coverage-v8` (:65), `vitest` (:76), `jsdom` (:69), `msw` (:70) | test runners/mocks |
| `eslint-config-prettier` (:67) | lint config |
| `typescript` ^6.0.3 (:73) vs new `~5.7.3` (:54) | **major downgrade** if replaced |

### 5.2 In `new-frontend/` only — added by the replacement

| Package | Class |
| --- | --- |
| `gsap` ^3.15.0 (:27) | heavy animation |
| `lenis` ^1.3.26 (:30) | heavy smooth-scroll |
| `@radix-ui/react-popover` (:17), `@radix-ui/react-slot` (:21) | UI primitives |
| `@eslint/js`, `globals`, `eslint-plugin-react-refresh` (dev) | lint config |

### 5.3 Present in both, versions differ

| Package | `frontend/` | `new-frontend/` | Risk |
| --- | --- | --- | --- |
| `react-router-dom` | ^7.18.4 | ^7.1.5 | downgrade, same major |
| `recharts` | ^3.10.1 | ^2.15.1 | **major downgrade** |
| `jspdf` | ^4.2.1 | ^2.5.2 | **major downgrade** |
| `lucide-react` | ^0.469.0 | ^0.474.0 | upgrade |
| `zustand` | ^5.0.15 | ^5.0.3 | downgrade, same major |
| `socket.io-client` | ^4.8.1 | ^4.8.4 | upgrade |
| `axios` | ^1.20.0 | ^1.20.0 | same |
| `@tanstack/react-query` | ^5.103.1 | ^5.66.0 | downgrade, same major |
| `tailwindcss` / `@tailwindcss/vite` | ^4.1.0 | ^4.0.6 | minor downgrade |
| `vite` | ^6.0.7 | ^6.1.0 | upgrade |
| `eslint` | ^10.11.0 | ^9.19.0 | **major downgrade** |
| `@eslint/js` | ^10.0.1 | ^9.19.0 | **major downgrade** |
| `eslint-plugin-react-hooks` | ^7.1.1 | ^5.1.0 | **major downgrade** |
| `typescript-eslint` | ^8.70.1 | ^8.23.0 | downgrade, same major |

### 5.4 Unmaintained / notable

No dependency in either manifest is abandoned. Two are worth flagging for the
merge:

- `html2canvas` ^1.4.1 in **both** — last published 2023, has known issues with
  modern CSS color functions (`oklch(...)`, which `new-frontend/src/index.css:13-114`
  uses exclusively). The PDF path therefore cannot be assumed to render the new
  theme correctly.
- `recharts` and `jspdf` are pinned at different **major** versions across the
  two manifests (§5.3); the replacement must pick one and re-verify the chart and
  PDF surfaces.

Duplicates to remove rather than carry: the old tree ships two HTTP clients'
worth of helpers (`src/lib/http.ts` + `src/lib/api.ts` facade); the new tree has a
single `src/lib/http.ts`.

---

## 6. Socket events

Old event table: [`frontend/src/lib/constants/socket-events.ts`](../frontend/src/lib/constants/socket-events.ts).
Old subscriptions: [`frontend/src/hooks/use-interview-socket.ts:128-359`](../frontend/src/hooks/use-interview-socket.ts#L128).
New hook: [`new-frontend/src/hooks/use-interview-socket.ts:79-173`](../new-frontend/src/hooks/use-interview-socket.ts#L79).
Server truth: [`backend/src/websocket/interview.gateway.ts:177-479`](../backend/src/websocket/interview.gateway.ts#L177).

### Client → server

| Event | Old emits | New emits | Status |
| --- | --- | --- | --- |
| `interview:join` | :155 | `use-interview-socket.ts:81` | same |
| `interview:leave` | :128, :359 | :145 | same |
| `heartbeat:ack` | :337 | — | missing-in-new |
| `answer:submit` | yes | :161 | **changed** — new sends `{interviewId, questionId, answer}`, server reads `{interviewId, questionId, answerData, answerType}` (`interview.gateway.ts:296`) |
| `code:submit` | yes | — | **missing-in-new** (must-survive #5) |
| `question:next` | yes | :168 | same |
| `interview:cancel` | yes | :173 | same |
| `interview:end` | yes | — | missing-in-new |
| `interview:extend_time` | yes | — | missing-in-new |

### Server → client

| Event | Old listens | New listens | Status |
| --- | --- | --- | --- |
| `connect` / `disconnect` / `connect_error` | :162,166,211 | :79,84,88 | changed (old `connect_error` performs auth recovery, new does not) |
| `interview:joined` | :247 | :92 | **changed** — new discards `timerStartedAt`, `durationMinutes`, `answeredQuestionIds` |
| `interview:left` | :266 | — | missing-in-new |
| `answer:accepted` | :271 | — | missing-in-new |
| `interview:state_change` | :274 | :134 | same (new handles `COMPLETED`/`TIMED_OUT` only) |
| `question:delivered` | :277 | — | **missing-in-new** |
| `question:next` (as a *server* event) | — | :96 | **new-only and wrong** — the server never emits `question:next`; it emits `question:delivered` (`interview.gateway.ts` never emits `question:next`) |
| `ai:status` | :288 | — | missing-in-new |
| `evaluation:feedback` | :291 | :120 | **changed** — new expects `{score, band, headline, decision}`; backend payload differs (`socket.types.ts:225-245`) |
| `timer:expired` | :327 | :130 | same |
| `interview:timer_extended` | :251 | — | missing-in-new |
| `heartbeat:ping` | :336 | — | missing-in-new |
| `ws:error` | :342 | :140 | changed (new only logs) |

---

## 7. Shared types

| Type / module | `frontend/` | `new-frontend/` | Status |
| --- | --- | --- | --- |
| `src/lib/types.ts` | 18 exports (`InterviewType`, `Difficulty`, `ExperienceLevel`, `InterviewStyle`, `EndingCriteria`, `INTERVIEW_STATUSES`, `User`, `InterviewConfig`, `Interview`, `QuestionKind`, `Question`, `Evaluation`, `Recommendation`, `InterviewReport`, `TimelineEvent*`, `Session`, `AdminUser`, `STATUS_META`, `DIFFICULTY_META`) | 22 exports, different shapes (`InterviewStatus`, `InterviewType`, `Difficulty`, `ExperienceLevel`, `SignalBand`, `UserRole`, `UserStatus`, `QuestionKind`, `User`, `Interview`, `Question`, `SkillScore`, `ScorePoint`, `InterviewReport`, `LobbyCheck`, `DeviceSession`, `AppNotification`, `LiveStatus`, `InterviewEvent`, `ContactPayload`, `Analytics*`, `AdminUserRow`, `PlatformStats`, `NewInterviewDraft`, `InterviewFilters`, `Paginated`) | **changed** — value domains differ (`Difficulty` `Easy\|Medium\|Hard\|Adaptive` → `easy\|medium\|hard\|expert`; `QuestionKind` `text\|code` → `behavioral\|technical\|situational\|mcq\|rating\|structured`) |
| `src/lib/types/api.ts` | 24 exports incl. `RecoverAccountRequest`, `RecoverAccountVerifyRequest`, `UpdateEmailRequest`, `UpdateEmailVerifyRequest`, `AnswerRequest`, `InterviewMetricsResponse`, `InterviewReportResponse` | `src/lib/api-types.ts` — 14 exports | **changed**; 7 request/response types missing-in-new |
| `src/lib/types/ws.ts` | 19 payload interfaces incl. `CodeSubmitPayload`, `ExtendTimePayload`, `TimerExtendedPayload` | — | **missing-in-new** (the new hook declares private ad-hoc interfaces at `use-interview-socket.ts:8-50`) |
| `src/lib/constants/socket-events.ts` | single source of event names | — | missing-in-new |
| `src/lib/constants/endpoints.ts` | single source of REST paths | — | missing-in-new (paths are inline in `src/lib/services/*.ts`) |
| `src/lib/normalizers/interview.ts` | `normalizeInterview` | inlined as `mapInterview` (`interviews.ts:32-59`) | changed |
| `BackendInterviewStatus` | `types/api.ts:150` | `api-types.ts:96` | same intent, changed members |
| `ErrorCode` union | `types/api.ts:28-45` | — (plain `string`, `http.ts:11`) | changed |

---

## 8. API call inventory

Old paths are centralised in
[`frontend/src/lib/constants/endpoints.ts`](../frontend/src/lib/constants/endpoints.ts);
new paths are inline in `new-frontend/src/lib/services/*.ts`. All paths below are
relative to `HTTP_BASE_URL` unless noted.

| # | Method + path | Old caller | New caller | Status |
| --- | --- | --- | --- | --- |
| 1 | `POST /auth/register` | `auth.service.ts:22` | `auth.ts:18` | same |
| 2 | `POST /auth/verify-otp` | `auth.service.ts:28` | `auth.ts:21` | same |
| 3 | `POST /auth/login` | `auth.service.ts:34` | `auth.ts:24` | same |
| 4 | `POST /auth/refresh` | `auth.service.ts:40`, `http.ts` interceptor | `auth.ts:27`, `http.ts:147` | same |
| 5 | `POST /usr/logout` | `auth.service.ts:46` | `auth.ts:30` | same |
| 6 | `GET /usr/me` | `auth.service.ts:52` | `auth.ts:33` | same |
| 7 | `GET /usr/sessions` | `auth.service.ts:58` | `auth.ts:36` | same |
| 8 | `DELETE /usr/session/:id` | `auth.service.ts:62` | `auth.ts:39` | same |
| 9 | `DELETE /usr/sessions` | `auth.service.ts:66` | `auth.ts:42` | same |
| 10 | `POST /auth/forgot-password` | `auth.service.ts:84` | `auth.ts:45` | same |
| 11 | `POST /auth/forgot-password/verify` | `auth.service.ts:90` | `auth.ts:48` | same |
| 12 | `POST /usr/update-password` | `auth.service.ts:96` | `auth.ts:51` | same |
| 13 | `PATCH /usr/profile` | `auth.service.ts:110` | `auth.ts:54` | same |
| 14 | `DELETE /usr/account` | `auth.service.ts:116` | `auth.ts:57` | same |
| 15 | `POST /auth/recover-account` | `auth.service.ts:72` | — | **missing-in-new** |
| 16 | `POST /auth/recover-account/verify` | `auth.service.ts:78` | — | **missing-in-new** |
| 17 | `POST /usr/update-email` | `auth.service.ts:102` | — | **missing-in-new** |
| 18 | `POST /usr/update-email/verify` | `auth.service.ts:106` | — | **missing-in-new** |
| 19 | `GET /interviews` (+ `?search,status,type,sort,page,pageSize`) | `interview.service.ts:15` | `interviews.ts:64,89` | **changed** — new always appends `sort`+`page`+`pageSize`; backend list takes no query params (`interview.routes.ts:57-63`) |
| 20 | `GET /interviews/resumable` | `interview.service.ts:21` | `interviews.ts:112` | same |
| 21 | `POST /interviews` | `interview.service.ts:40` | `interviews.ts:321` | **changed** — new body is `{roleTitle, field, company, type, topics, experienceLevel, difficulty, durationMinutes, rounds}`; backend validates `createInterviewSchema` with `jobrole/experience/difficulty/isAdaptive/interviewStyle/interviewType/duration/maxFollowUps/isScheduled/scheduledDate/...` (`interview.service.ts:156-173`) |
| 22 | `GET /interviews/:id` | `interview.service.ts:63` | `interviews.ts:94` | same |
| 23 | `GET /interviews/:id/history` | `interview.service.ts:69` | `interviews.ts:117,181` | **changed** — old expects `TimelineEvent[]`; new expects `{questions: [...]}` (server shape is an object) |
| 24 | `GET /interviews/:id/metrics` | `interview.service.ts:77` | — | **missing-in-new** |
| 25 | `GET /interviews/:id/report` | `interview.service.ts:85` | `interviews.ts:182` | same path; **changed** mapping (new derives `band`, `progression`, `topics` client-side at `interviews.ts:215-233`, ignores `difficultyProgression`) |
| 26 | `POST /interviews/:id/start` | `interview.service.ts:91` | `interviews.ts:343` | same |
| 27 | `POST /interviews/:id/pause` | `interview.service.ts:97` | — | **missing-in-new** |
| 28 | `POST /interviews/:id/resume` | `interview.service.ts:103` | — | **missing-in-new** |
| 29 | `POST /interviews/:id/cancel` | `interview.service.ts:109` | `interviews.ts:339` | same |
| 30 | `POST /interviews/:id/end` | `interview.service.ts:115` | `interviews.ts:347` | same (but never called from the end dialog) |
| 31 | `POST /interviews/:id/questions/:questionId/answer` | `interview.service.ts:124` | — (socket path only) | **missing-in-new over HTTP** |
| 32 | `DELETE /interviews/:id` | via `api` facade | `interviews.ts:351` | same |
| 33 | `POST /interviews/:id/share` | `interview.service.ts:137` | `interviews.ts:355` | same |
| 34 | `POST /interviews/:id/share/revoke` | `interview.service.ts:144` | `interviews.ts:359` | same |
| 35 | `GET /interviews/shared/:token` | `shared-report.tsx:94` | `interviews.ts:105,276` | **changed** — new reads `{interview, report, questions}` (server shape, `interview.service.ts:2071-2086`) |
| 36 | `GET /analytics/me` | `analytics.service.ts:39` | `analytics.ts:40` | same |
| 37 | `GET /analytics/me/trend` | `analytics.service.ts:46` | `analytics.ts:44` | **changed** — new expects `[{label, score, benchmark}]`, server returns `{trendData, overallStats}` |
| 38 | `GET /admin/overview` | `admin.service.ts:227` (sends `period`) | `admin.ts:7` (no query) | **changed** — relies on server default |
| 39 | `GET /admin/users` | `admin.service.ts:161` | `admin.ts:10` | **changed** — new sends `status` filter which `userListQuerySchema` does not define (`admin.zschema.ts:36-49`) |
| 40 | `GET /admin/users/:id` | `admin.service.ts:168` | — | **missing-in-new** |
| 41 | `PATCH /admin/users/:id/role` | `admin.service.ts:175` body `{newRole}` | `admin.ts:20` body `{role}` | **shape-mismatch** (`admin.zschema.ts:52-54`) |
| 42 | `POST /admin/users/:id/suspend` | `admin.service.ts:182` body `{reason}` | `admin.ts:23` no body | same endpoint; body optional server-side (`admin.zschema.ts:57-59`) |
| 43 | `POST /admin/users/:id/reinstate` | `admin.service.ts:189` | `admin.ts:26` | same |
| 44 | `GET /admin/interviews` | `admin.service.ts:209` | — | **missing-in-new** |
| 45 | `GET /admin/interviews/:id/metrics` | `admin.service.ts:220` | — | **missing-in-new** |
| 46 | `GET /notifications` | `notification.service.ts:39` | `notifications.ts:5` | **changed** — new omits `page`/`limit`/`unreadOnly` (server defaults apply) |
| 47 | `PATCH /notifications/read-all` | `notification.service.ts:49` | `notifications.ts:8` | same |
| 48 | `PATCH /notifications/:id/read` | `notification.service.ts:44` | `notifications.ts:11` | same |
| 49 | `POST /contact` | `contact.service.ts:11` | `contact.ts:5` | same |
| 50 | `GET /ready` (root, not versioned) | `health-check.ts:41` | `health-check.ts:7` | **changed** — new hardcodes `?source=keepalive` instead of `ENDPOINTS.system.ready` + probe constant |
| 51 | `GET /health` (root) | declared in `ENDPOINTS.system` | — | missing-in-new (unused by old code as well) |

---

## 9. Intentionally dropped features and migration status

No frontend tree swap or deliberate feature drop is recorded by this discovery
report. The target snapshot omits multiple shipped features listed in §3; these
are migration gaps, not approved removals. The task requires preserving every
item marked `missing-in-new`, especially the code-answer UI/editor, code answer
socket submission, answer-draft persistence, code-aware PDF output, socket auth
recovery, and tests. No reason to intentionally drop any of those was supplied.

The requested typecheck, lint, unit/integration, route-render, and E2E
acceptance checks have **not been established** against the target snapshot: it
is stored as a bare Git snapshot rather than a checked-out `new-frontend/`
working directory, and the snapshot manifest has no test scripts. Do not treat
this inventory as an acceptance pass. The target manifest has `dev`, `build`,
`typecheck`, `lint`, and `preview`, but not the old unit/integration/E2E scripts;
see §4.4-4.5. Regenerate and commit the target `package-lock.json` after bringing
the replacement into the project, as requested.

---

*End of read-only discovery. This report does not perform the tree swap.*
