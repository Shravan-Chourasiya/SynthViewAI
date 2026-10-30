# Frontend ↔ backend gap matrix

Contract audit of the replacement client in [`frontend/`](../frontend/) against
[`backend/`](../backend/), plus the fixes applied for each gap.

**Status values**

| Status | Meaning |
| --- | --- |
| `exists` | Route/event exists and request + response shapes already agree. |
| `shape-mismatch` | Route/event exists, but a payload or response field did not match. |
| `missing` | The client needs something the backend does not provide. |
| `deferred` | Real gap, deliberately not implemented in this pass — reason given in §4. |

**Evidence**: every row below was read in the working tree and is cited with a
file and line. Line numbers are from this checkout; re-verify with
`git diff --stat` after further edits. Nothing in this document is inferred
from a design mock.

---

## 1. HTTP matrix

All client calls go through [`frontend/src/lib/http.ts`](../frontend/src/lib/http.ts)
(cookies + CSRF header + silent `/auth/refresh` on 401 + `{success,data}` unwrap),
so the rows below are only the endpoint contracts.

### 1.1 Authentication and account — `frontend/src/lib/services/auth.ts`

| # | Client call | Backend route | Status | Fix |
| --- | --- | --- | --- | --- |
| 1 | `POST /auth/register` (`auth.ts:24`) | `auth.routes.ts:45`, `registerSchema` | exists | — body already matches `{email,password,username,firstName?,lastName?}` |
| 2 | `POST /auth/verify-otp` (`auth.ts:28`) | `auth.routes.ts:48` | exists | — |
| 3 | `POST /auth/login` (`auth.ts:32`) | `auth.routes.ts:55` | exists | — `deviceType` is optional server-side (default `desktop`) |
| 4 | `POST /auth/refresh` (`auth.ts:36`) | `auth.routes.ts:59` | exists | — also used by the 401 interceptor (`http.ts:139`) |
| 5 | `POST /usr/logout` (`auth.ts:40`) | `auth.routes.ts:62` | exists | — |
| 6 | `GET /usr/me` (`auth.ts:44`) | `auth.routes.ts:113` | exists | — response fields match `MeResponse` (`api-types.ts:25-39`) |
| 7 | `GET /usr/sessions` (`auth.ts:48`) | `auth.routes.ts:117` | exists | — `SessionResponse` matches the service projection (`auth.service.ts:835-846`) |
| 8 | `DELETE /usr/session/:id` (`auth.ts:52`) | `auth.routes.ts:130` | exists | — |
| 9 | `DELETE /usr/sessions` (`auth.ts:56`) | `auth.routes.ts:123` | exists | — |
| 10 | `POST /auth/forgot-password` (`auth.ts:60`) | `auth.routes.ts:84` | exists | — |
| 11 | `POST /auth/forgot-password/verify` (`auth.ts:64`) | `auth.routes.ts:92` | exists | — `{email,otp,newPassword,confirmPassword}` matches |
| 12 | `POST /auth/recover-account` (`auth.ts:69`) | `auth.routes.ts:68` | exists | — |
| 13 | `POST /auth/recover-account/verify` (`auth.ts:73`) | `auth.routes.ts:71` | exists | — |
| 14 | `POST /usr/update-email` (`auth.ts:78`) | `auth.routes.ts:97` | exists | — **never called by any screen** (see §5.3) |
| 15 | `POST /usr/update-email/verify` (`auth.ts:82`) | `auth.routes.ts:105` | exists | — **never called by any screen** (see §5.3) |
| 16 | `POST /usr/update-password` (`auth.ts:86`) | `auth.routes.ts:88` | exists | — |
| 17 | `PATCH /usr/profile` (`auth.ts:90`) | `auth.routes.ts:115` | exists | wired in this pass: `auth-store.ts:148-154`, called from `profile.tsx:96` and `settings/index.tsx:97` |
| 18 | `DELETE /usr/account` (`auth.ts:94`) | `auth.routes.ts:65` | exists | — |

### 1.2 Interviews — `frontend/src/lib/services/interviews.ts`

| # | Client call | Backend route | Status | Fix |
| --- | --- | --- | --- | --- |
| 19 | `GET /interviews?search&status&type&sort&page&pageSize` (`interviews.ts:90`) | `interview.routes.ts:57` → `getAllInterviewsService` (`interview.service.ts:224`) | **shape-mismatch** | **Frontend.** The list route takes no query params and never did — the service ignores them silently. The client now fetches the owned list once and filters, sorts and pages it locally (`interviews.ts:77-118`) instead of pretending the server does. Adding a server-side query contract would be a new backend feature, not a contract repair. |
| 20 | `GET /interviews/resumable` (`interviews.ts:144`) | `interview.routes.ts:65` | exists | returns a bare array of rows — matches |
| 21 | `GET /interviews/:id` (`interviews.ts:127`) | `interview.routes.ts:73` | exists | ownership enforced by `requireOwnership` |
| 22 | `GET /interviews/:id/history` (`interviews.ts:149,218`) | `interview.routes.ts:81` | exists | **400 unless the interview is terminal** (`interview.service.ts:1339-1351`) — the report path already tolerates that (`.catch(() => ({questions: []}))`) |
| 23 | `GET /interviews/:id/report` (`interviews.ts:217`) | `interview.routes.ts:97` | exists | response mapped into the view model in `interviews.ts:186-280` |
| 24 | `GET /interviews/shared/:token` (`interviews.ts:136,315`) | `interview.routes.ts:196` | exists | `{interview, report, questions}` matches `getSharedReportService` (`interview.service.ts:2056-2084`) |
| 25 | `POST /interviews` (`interviews.ts:419`) | `interview.routes.ts:45` + `createInterviewSchema` (`interview.zschema.ts:4-45`) | **shape-mismatch** | **Frontend** (fixed). The wizard draft speaks display vocabulary (`roleTitle/field/experienceLevel/durationMinutes/type: 'mixed'`), the schema requires `jobrole`, a numeric `duration` and uppercase enums. `interviews.ts:374-417` now maps: experience (`intern→fresher`, `mid→mid-level`, `staff|lead→senior`), difficulty (`expert→HARD`), `interviewType→UPPERCASE`, `topics→jobSkills`, company archetype label → `targetedCompanyOther`, `interviewStyle: 'REGULAR'`, `endingCriteria: 'DURATION'`, `isScheduled: false`. |
| 26 | `POST /interviews/:id/start` (`interviews.ts:430`) | `interview.routes.ts:118` | exists | **now actually called**: the room starts the session before dialling the socket (`live.tsx:97-118`) because `interview:join` requires the Redis context that `start` creates (`interview.gateway.ts:190-197`) |
| 27 | `POST /interviews/:id/cancel` (`interviews.ts:426`) | `interview.routes.ts:152` | exists | — |
| 28 | `POST /interviews/:id/end` (`interviews.ts:434`) | `interview.routes.ts:162` | exists | **now called** by the end dialog (`live.tsx:114-124`), which previously only navigated away — no report was ever produced |
| 29 | `DELETE /interviews/:id` (`interviews.ts:438`) | `interview.routes.ts:107` | exists | — |
| 30 | `POST /interviews/:id/share` (`interviews.ts:442`) | `interview.routes.ts:176` | exists | server returns `{token, shareUrl, expiresIn}` — superset of the `{token}` the client reads |
| 31 | `POST /interviews/:id/share/revoke` (`interviews.ts:446`) | `interview.routes.ts:186` | exists | body `{token}` matches `revokeShareSchema` |
| 32 | `POST /interviews/:id/questions/:questionId/answer` (HTTP) | `interview.routes.ts:167` | exists | not used by the client — answers travel on `answer:submit` over the socket (equivalent, not a gap) |
| 33 | `POST /interviews/:id/pause`, `/resume` | `interview.routes.ts:132,142` | deferred | client has no pause/resume control wired — §4.1 |

### 1.3 Admin — `frontend/src/lib/services/admin.ts`

| # | Client call | Backend route | Status | Fix |
| --- | --- | --- | --- | --- |
| 34 | `GET /admin/overview?period=` (`admin.ts:141`) | `admin.routes.ts:41` → `getOverviewStats` (`admin.service.ts:665`) | **shape-mismatch** | **Frontend** (fixed). Server answers `{totalUsers,totalInterviews,interviewsByStatus,recentSignups,activeUsers}`; the page reads `PlatformStats` (`types.ts:164-170`). Mapped in `admin.ts:116-137`; `scoreBands`, `topRoles` and the week-by-week signup series have **no backend aggregate** and are returned empty — §4.6. |
| 35 | `GET /admin/users?search&role&status&page&limit` (`admin.ts:158`) | `admin.routes.ts:49` → `listUsers` | **missing** + **shape-mismatch** | Both fixed. (a) `status` did not exist: added to `userListQuerySchema` (`admin.zschema.ts:35-42`), threaded through `admin.controller.ts:39,48` and applied in `admin.service.ts:192-197` against `account_status`; test in `tests/unit.schemas.test.ts`. (b) Response is `{users,total,page,limit,totalPages}` with `userrole/isActive/accountStatus/interviewCount`, not `AdminUserRow[]`; mapped in `admin.ts:55-82` (name join, role/status derivation, `lastActiveAt` fallback). |
| 36 | `PATCH /admin/users/:id/role` body `{role}` (`admin.ts:166` before fix) | `admin.routes.ts:57` + `updateUserRoleSchema` (`admin.zschema.ts:56-58`) | **shape-mismatch** | **Frontend** (fixed). Zod strips the unknown `role` key, so the request failed validation with `newRole` missing. Now sends `{newRole}` with the product→wire role map. |
| 37 | `POST /admin/users/:id/suspend` (`admin.ts:170,174`) | `admin.routes.ts:64` | exists | route has **no `validateBody(suspendUserSchema)`**; the service defaults the reason (`admin.service.ts:412`), and the client now always sends a body. Adding the validator is recommended hardening, not a contract gap. |
| 38 | `POST /admin/users/:id/reinstate` (`admin.ts:171,176`) | `admin.routes.ts:71` | exists | — |
| 39 | `GET /admin/interviews`, `/admin/interviews/:id`, `/admin/interviews/:id/metrics` | `admin.routes.ts:78-98` | deferred | The admin screens call the **candidate-scoped** `interviewService.list/get/report` instead (`pages/admin/interviews.tsx:29`, `pages/admin/interview-report.tsx:21,26`), bypassing the moderator/admin gates and the anonymised `candidateReference` projection — §4.5 |

### 1.4 Analytics — `frontend/src/lib/services/analytics.ts`

| # | Client call | Backend route | Status | Fix |
| --- | --- | --- | --- | --- |
| 40 | `GET /analytics/me` (`analytics.ts:40`) | `analytics.routes.ts:31` → `analytics.service.ts:33` | exists | `overallStats/trendData/categoryBreakdown/performanceByCategory` match exactly |
| 41 | `GET /analytics/me/trend` (`analytics.ts:50`) | `analytics.routes.ts:37` → `analytics.controller.ts:44-61` | **shape-mismatch** | **Frontend** (fixed): server answers `{trendData, overallStats}`, the caller expected `[{label,score,benchmark}]`; mapped in `analytics.ts:44-56` |

### 1.5 Notifications, contact, system

| # | Client call | Backend route | Status | Fix |
| --- | --- | --- | --- | --- |
| 42 | `GET /notifications` (`notifications.ts:42`) | `notification.routes.ts:24` → `notification.service.ts:51-79` | **shape-mismatch** | **Frontend** (fixed): response is `{items,page,limit,total}` of table rows (`type`, `readAt`); mapped to `NotificationResponse[]` (`kind`, `read`) in `notifications.ts:35-45` |
| 43 | `PATCH /notifications/read-all` (`notifications.ts:48`) | `notification.routes.ts:33` | exists | — |
| 44 | `PATCH /notifications/:id/read` (`notifications.ts:50`) | `notification.routes.ts:41` | exists | id validated as uuid (`notification.zschema.ts:29-31`) |
| 45 | `POST /contact` (`contact.ts:6`) | `contact.routes.ts:14` | exists | `{name,email,subject,message}` matches `contactSubmissionSchema` |
| 46 | `GET /health`, `GET /ready` | `app.ts:70,78` | exists | polled by `lib/health-check.ts` (root paths, outside the version prefix) |

---

## 2. Socket matrix

Event names and payload shapes are declared once in
[`frontend/src/lib/constants/socket-events.ts`](../frontend/src/lib/constants/socket-events.ts)
and typed in [`frontend/src/lib/types/ws.ts`](../frontend/src/lib/types/ws.ts);
the implementation is
[`frontend/src/hooks/use-interview-socket.ts`](../frontend/src/hooks/use-interview-socket.ts)
with state in [`frontend/src/lib/stores/live-interview.store.ts`](../frontend/src/lib/stores/live-interview.store.ts).
Backend side: `backend/src/websocket/socket.types.ts` and
`backend/src/websocket/interview.gateway.ts`.

### 2.1 Client → server

| Event | Payload | Backend | Status | Fix |
| --- | --- | --- | --- | --- |
| `interview:join` | `{interviewId, eventVersion, event}` | `socket.types.ts:20-23`, `gateway:177` | exists | emitted on every `connect`, so a reconnect re-joins (`use-interview-socket.ts:221-226`) |
| `interview:leave` | `{interviewId,…}` | `socket.types.ts:26-29`, `gateway:236` | exists | on unmount and `beforeunload` |
| `heartbeat:ack` | `{eventVersion,event,timestamp}` | `socket.types.ts:36-39`, `gateway:478-480` | **missing** | **fixed** — the client never answered `heartbeat:ping`; now emitted at `use-interview-socket.ts:355-361` |
| `answer:submit` | `{interviewId,questionId,answerData,answerType}` | `socket.types.ts:81-88`, `gateway:294-317` | exists | `submitAnswer` (`:409`) |
| `code:submit` | `{interviewId,questionId,language,code}` | `socket.types.ts:90-97`, `gateway:319-360` | exists | `submitCode` (`:420`) — kept as its own event so language and code are stored separately |
| `question:next` | `{interviewId,…}` | `socket.types.ts:104-107` | exists | requested after `evaluation:feedback` when `shouldAdvance !== false` (`:318-330`) |
| `interview:cancel` | `{interviewId,…}` | `socket.types.ts:110-113` | exists | `:426` |
| `interview:end` | `{interviewId,…}` | `socket.types.ts:115-118` | exists | `:430` (the end dialog also uses the HTTP route) |
| `interview:extend_time` | `{interviewId,extraMinutes}` | `socket.types.ts:122-127` | exists | emitted by `extendTime` (`:436`) — **no UI invokes it yet** (§4.2) |

### 2.2 Server → client

| Event | Payload fields the client uses | Status | Fix |
| --- | --- | --- | --- |
| `interview:joined` | `timerStartedAt`, `durationMinutes`, `answeredQuestionIds` | exists | drives the countdown and the answered count (`:275-278`) |
| `interview:left` | — | exists | resets the store (`:280`) |
| `answer:accepted` | `questionId` | exists | marks the question answered (`:286`) |
| `interview:state_change` | `status` | exists | terminal `COMPLETED`/`TIMED_OUT` ends the room (`:290`, `:470-474`) |
| **`question:delivered`** | `questionId`, `sequenceNumber`, `totalQuestions`, `questionTitle`, `questionDescription`, `questionType`, **`answerFormat`**, `codeLanguage`, `topic`, `isFollowUp`, `deliveredAt`, `timeoutSeconds` | **shape-mismatch** | **Frontend** (fixed). The client listened for `question:next` **as an inbound event — the server never emits it**, so a real room could never receive a question. Now handled at `:294-302` with `questionFromPayload` (`:60-76`): `answerFormat === 'CODE' → kind: 'code'` (the shipped kind mapping), `sequenceNumber-1 → index`, description → editor placeholder, `codeLanguage` carried through. |
| `ai:status` | `stage` | exists | sets the busy state (`:304`) |
| **`evaluation:feedback`** | `score`, `feedback`, `strengths`, `weaknesses`, `shouldAdvance` | **shape-mismatch** | **Frontend** (fixed). The client read `band`/`headline`/`decision`, none of which exist on the wire. `evaluationFromPayload` (`:79-88`) derives the signal band from `score` (85/70/55 thresholds shared with the report) and uses `feedback` as the headline; `shouldAdvance` drives the busy state and the `question:next` request (`:308-330`). |
| `timer:expired` | `expiredAt` | exists | pauses the room: submit is blocked, no advance (`:346-352`) |
| `interview:timer_extended` | `timerStartedAt`, `durationMinutes`, `extraMinutes`, `totalQuestions` | exists | re-derives the countdown and pays a pending advance (`:333-345`) |
| **`heartbeat:ping`** | `timestamp` | **missing** | **fixed** — answered with `heartbeat:ack` (`:355-361`) |
| `ws:error` | `code`, `message` | exists | maps to copy, **clears the busy state** so a rejected answer can be retried, and triggers auth recovery for `AUTH_*` (`:363-374`) |

**Auth recovery** (must-survive): `connect_error` with an `AUTH_*` message and
`ws:error` with `AUTH_UNAUTHORIZED`/`AUTH_SESSION_EXPIRED` both run
`recoverAuth()` — refresh, re-bootstrap the store, re-dial — with a guard
against a refresh/connect loop (`use-interview-socket.ts:204-218, 371-373`).

---

## 3. Enums and status values

| Domain | Backend | Client | Status | Where reconciled |
| --- | --- | --- | --- | --- |
| interview status | `DRAFT, READY, SCHEDULED, INPROGRESS, COMPLETED, CANCELLED, ABANDONED, EXPIRED, TIMED_OUT` (`interview.schema.ts:14-25`) | `BackendInterviewStatus` (identical) → view `draft/scheduled/in-progress/completed/abandoned` | exists | `interviews.ts:11-26` (`toFrontendStatus`) |
| interview type | `BEHAVIORAL/TECHNICAL/MIXED` | `behavioral/technical/mixed` | shape-mismatch | mapped on write (`interviews.ts:396-401`) and read (`:45`) |
| difficulty | `EASY/MEDIUM/HARD` | `easy/medium/hard/expert` | shape-mismatch | `expert → HARD` on write (`interviews.ts:391-395`); read lower-cases |
| experience | `fresher/junior/mid-level/senior` | `intern/junior/mid/senior/staff/lead` | shape-mismatch | `interviews.ts:384-390` |
| user role | `user/moderator/admin/owner` | `candidate/reviewer/admin` | shape-mismatch | `admin.ts:34-50` — `owner` renders as `admin` (no owner badge in the console) |
| account status | `active/suspended/disabled/deleted` | `active/invited/suspended` | shape-mismatch | derived: `suspended` → suspended, `active && !isVerified` → invited (`admin.ts:52-58`); filter sends only server-known values (`admin.ts:155`) |
| answer format | `TEXT/CODE` | `answerFormat` → `kind: 'code' \| 'text'` | exists | `use-interview-socket.ts:60-76`, `interviews.ts:158,241,330` |
| answer type | `TEXT/AUDIO/VIDEO` | sends `TEXT` | exists | `use-interview-socket.ts:409` |
| notification type | `REMINDER_24H/REMINDER_1H/INTERVIEW_PAUSED` | `kind: interview/report/system` | shape-mismatch | all three map to `interview` (`notifications.ts:35-45`); the backend can create **no** `report` or `system` notification today |
| question state | `ANSWERED/EVALUATED/…` | not consumed directly | exists | the history mapping reads `evaluationData`/`answerData` only |

---

## 4. Deferred (needs a product or lifecycle decision)

1. **Pause / resume controls.** `POST /interviews/:id/pause|resume` exist
   (`interview.routes.ts:132,142`) but the room's pause toggle is local only —
   it stops the elapsed counter, nothing else (`live.tsx:139-145`). Wiring it
   changes status transitions, which this task explicitly excludes.
2. **"Add more time" prompt.** The hook can emit `interview:extend_time` and
   correctly handles `interview:timer_extended`, but no UI asks the candidate
   when the duration runs out; the room simply blocks submit until they end.
3. **Scheduled interviews.** `createInterviewSchema` supports
   `isScheduled`/`scheduledDate` and the backend has reminder/expiry jobs, but
   the wizard collects no date, so `isScheduled: false` is always sent
   (`interviews.ts:414`). Adding the step is a product change, not a contract fix.
4. **`rounds`.** The wizard offers a round count (`ROUND_OPTIONS`,
   `constants/interview.ts:70`) but the create contract has no rounds concept;
   it is no longer sent, and displays fall back to `1` (`interviews.ts:50`).
5. **Admin screens on admin endpoints.** `pages/admin/interviews.tsx:29` and
   `pages/admin/interview-report.tsx:21,26` read the candidate-scoped list/
   detail/report. Moving them to `GET /admin/interviews[/:id[/metrics]]` needs a
   response mapping for the anonymised candidate reference and the
   metrics-only projection (`admin.routes.ts:78-98`), and touches the report
   screen — deliberately left out of a pass that must not change report
   generation.
6. **Admin overview aggregates.** `scoreBands`, `topRoles` and the week-by-week
   signup series have no backend source; `getOverviewStats` returns counts by
   status only. The overview therefore renders empty score/role panels
   (`admin.ts:133-135`). Building the aggregates is new analytics work.
7. **Email change UI.** `/usr/update-email` + `/verify` exist and are typed
   (`auth.ts:78-82`) but no screen drives the OTP step — see §5.3.

---

## 5. Mock / pretend behaviour still in the client

| # | Where | What it fakes | Note |
| --- | --- | --- | --- |
| 5.1 | `frontend/src/lib/services/mock-data.ts` (497 lines) | Fixture interviews, notifications, reports, share tokens | **Unreferenced** — `grep -r mock-data src` returns nothing outside the file itself. Dead code; safe to delete in a cleanup pass. |
| 5.2 | `settings/index.tsx:118-140` | "Prototype role" switcher: `patchUser({ role })` mutates local state only and the copy says *"This build ships with mock auth"* | Roles are server-authorised; this button changes nothing server-side and should be removed or relabelled before launch. |
| 5.3 | `settings/index.tsx:107-119` | Editable **email** field plus a Save button that only fires `toast.success('Account updated')` | No request is made. The real flow is `POST /usr/update-email` → OTP → `POST /usr/update-email/verify`; wiring it needs a verify step in this screen. |
| 5.4 | `live.tsx` pause toggle | Local `paused` state stops the elapsed counter only | Server-side pause is §4.1 |
| 5.5 | `use-interview-socket.ts:449` | `streamed` is always `''` | The server emits `ai:status` stages, not token streams, so the typing effect has nothing to render |
| 5.6 | `admin.ts:119,164` | `avgScore` is always `null`, `scoreBands`/`topRoles` always `[]` | Backend projections carry no score aggregate (§4.6); renders as `—` / empty panels rather than invented numbers |

Genuine client-only behaviour (not pretend): the lobby camera/microphone
checks (`lobby.tsx:56-86`) and session notes — both are local by nature.

---

## 6. Changes made in this pass

| File | Change |
| --- | --- |
| `frontend/src/lib/services/interviews.ts` | Create body mapped onto `createInterviewSchema`; list filtered/sorted/paged client-side; `questionCount` and company read from `interviewMetaData` |
| `frontend/src/lib/services/admin.ts` | Role/status enum maps, `{newRole}` body, overview + user-list response mappers, `status` filter |
| `frontend/src/lib/services/notifications.ts` | Envelope + row mapper (`readAt → read`, `type → kind`) |
| `frontend/src/lib/services/analytics.ts` | `trend` mapped from `{trendData}` |
| `frontend/src/lib/stores/auth-store.ts` | New `updateProfile` action that persists through `PATCH /usr/profile` |
| `frontend/src/pages/profile.tsx`, `settings/index.tsx` | Save handlers call `updateProfile` instead of patching local state |
| `frontend/src/lib/socket/interview-socket.ts` | Socket factory restored (single construction point, mockable in tests) |
| `frontend/src/lib/stores/live-interview.store.ts` | Live room state: timer, busy state, redelivery-safe question handling, answered ids |
| `frontend/src/hooks/use-interview-socket.ts` | Rewritten against the real protocol: `question:delivered`, `evaluation:feedback` mapping, `heartbeat:ack`, rejoin, auth recovery, `extend_time` |
| `frontend/src/pages/interviews/live.tsx` | Starts the session before joining, submits text answers on `answer:submit`, ends through `POST /interviews/:id/end`, server-driven question index |
| `frontend/src/__tests__/mocks/fake-socket.ts` | Added `emitted` map + `ioEmit` so outbound payloads can be asserted |
| `backend/src/modules/admin/zodschemas/admin.zschema.ts` | `status` filter on `userListQuerySchema` |
| `backend/src/modules/admin/services/admin.service.ts` | `status` filter applied against `account_status` |
| `backend/src/modules/admin/controllers/admin.controller.ts` | Thread `status` from the validated query |
| `backend/tests/unit.schemas.test.ts` | 5 new cases covering the `status` filter and its rejection of unknown values |

No backend lifecycle, timer or report-generation code was modified.

---

## 7. Verification

| Check | Result |
| --- | --- |
| `frontend`: `tsc --noEmit` | **pass** |
| `frontend`: socket suites (`unit/hooks/use-interview-socket.test.ts`, `unit/lib/hooks/…`, `unit/lib/socket/interview-socket.test.ts`) | **49/49 pass** |
| `frontend`: `vitest run` (whole suite) | 18 files pass / 37 fail — was 14/41 before this pass; the remaining failures predate it (see note below) |
| `backend`: `tsc --noEmit` | **pass** |
| `backend`: `tsc --noEmit -p tsconfig.test.json` | fails **pre-existing** — identical errors with this pass stashed; they are in `tests/integration.*` fixtures (missing `username`, stale inserts), not in the files changed here |
| `backend`: `tests/unit.schemas.test.ts` | **64/64 pass** (includes the 5 new cases) |
| `backend`: `vitest run tests/unit` | 425 pass / 24 fail across 8 files — **pre-existing**: those files fail identically with this pass stashed (`git stash push -- src/modules/admin tests/unit.schemas.test.ts` reproduces it), and none of them import the admin modules touched here |

### 7.1 Smoke run against the real backend

| Step | Result |
| --- | --- |
| Boot the API (`PORT=4000 npx tsx src/server.ts`, real `.env`) | **pass** — starts, serves |
| `GET /health` | **200** `{"status":"OK"}` |
| `GET /ready` | **200** `{"checks":{"database":"ok","redis":"ok"}}` — the configured Postgres and Redis are reachable |
| Auth gating: `GET /api/v1/interviews`, `/admin/users`, `/notifications` with no session | **401** on all three |
| Create-interview payload validation | **pass** — the exact body `interviews.ts` builds for three representative drafts (mixed/mid/medium, technical/senior/expert, behavioral/intern/easy, with and without a company) parses cleanly against `createInterviewSchema`, and `updateUserRoleSchema`/`userListQuerySchema` accept the admin body and query this pass introduced |
| Admin contract probes | **pass** — see `tests/unit.schemas.test.ts` (64/64) |
| login → create → live room → report, end to end | **not run — blocked** (see below) |

**Why the full e2e path could not run here**

1. There is no account with known credentials in this environment. Registering a
   throwaway user returns `201`, but the OTP is stored **bcrypt-hashed** in Redis
   (`redis.service.ts:32-45`) and is deliberately never logged
   (`mail.service.ts:13`), and login refuses an unverified account (`401
   AUTH_INVALID_CREDENTIALS`). Exercising it needs a mailbox the agent does not
   have; no user row was left behind (verified: `select … where email ilike
   '%gap-smoke%'` → empty).
2. The repository's own integration/e2e suites (`tests/integration.*`) boot
   Postgres and Redis through **testcontainers**, and Docker is not running on
   this machine (`Could not find a working container runtime strategy`), so
   `integration.interview-e2e.test.ts` / `integration.e2e.test.ts` cannot
   execute either.

Both blockers are environmental, not contract failures: with a test account (or
Docker enabled) the same commands above become the login → create → live →
report smoke.

**Note on the remaining frontend failures.** The 37 failing files belong to the
wider replacement migration (they assert components, stores and a
`renderWithProviders` layout from the previous tree — `No QueryClient set`,
`Element type is invalid`, `Cannot find module '@/lib/stores/…'`). They are not
contract gaps: each failure I traced resolves to a missing module or a missing
provider, not to an API shape. They are tracked as migration work, not as
backend work.
