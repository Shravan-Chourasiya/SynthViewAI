# SynthView AI — frontend

The entire UI for **SynthView AI**, an AI-driven adaptive mock-interview platform. Calm,
technical, developer-tool aesthetic: deep blue-slate dark theme by default, a cool off-white
light theme, one electric-blue accent, hairline borders, mono-spaced data labels, restrained motion.

**This is a UI prototype.** There is no backend. Every screen is wired to small typed service
modules that return realistic mock data, so a real REST API and WebSocket can be dropped in
without touching a single component.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | React 18 + TypeScript + Vite 6 |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` (CSS-first `@theme inline`, no `tailwind.config.js`) + `tw-animate-css` |
| Routing | `react-router-dom` v7, lazy routes with `Suspense` + skeleton fallbacks |
| Client state | `zustand` |
| Server state | `@tanstack/react-query` |
| Primitives | Radix (dialog, select, tabs, progress, separator, avatar, popover) + `cva`/`clsx`/`tailwind-merge` |
| Icons / charts / toasts | `lucide-react`, `recharts`, `sonner` |
| Export | `html2canvas` + `jsPDF` (lazy-loaded) |
| Fonts | Inter (400–800) and JetBrains Mono (400–700) via Google Fonts |

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # tsc --noEmit
npm run lint       # eslint .
npm run build      # tsc --noEmit && vite build
```

The app starts signed out. `/login` is pre-filled with demo credentials; any values work
because auth is mocked. To look at the admin surfaces, sign in and use
**Settings → Account → Prototype role → admin**.

## Design system

All tokens live in [`src/index.css`](src/index.css) — there is no Tailwind config file.

- Two full token sets (`:root, .light` and `.dark`) using `oklch`, exposed to Tailwind through
  `@theme inline` as `--color-*` (background, card, primary, sidebar, `signal-*`, `chart-1..5`,
  `grid-line`, …) plus the radius scale derived from `--radius: 0.75rem`.
- **Signal colours are functional, never decorative:** `strong` = green, `good` = blue,
  `vague` = amber, `weak` = red — the same mapping in badges, chips, meter fills, chart bars
  and status dots.
- **Typography rule:** Inter for headings and body; JetBrains Mono is reserved for data and
  metadata (statuses, counts, dates, IDs, timers, scores, eyebrow pills, table headers),
  usually `text-[10px]`/`text-[11px] uppercase tracking-wider tabular-nums`.
- Motion utilities (`animate-reveal`, `animate-rise-in`, `animate-word-up`, `animate-rise-3d`,
  `animate-orbit-x`/`-y`, `animate-typing-bar`, …) are plain classes so they can carry
  `animation-delay: calc(var(--stagger-i) * 55ms)`. They are gated on `<html data-motion="reduced">`
  rather than the media query — see **Motion** below.
- 3D/motion primitives live in `components/motion/` and `hooks/`: `TiltCard` + `SpotlightPanel`,
  `SplitText` (masked per-word reveal), `Magnetic`, `Odometer`, plus `useTilt` / `useSpotlight` /
  `useMagnetic` (rAF-lerped, writing transforms and CSS variables directly so nothing re-renders
  React). `NeuralField` is a dependency-free 3D point cloud on a 2D canvas — fibonacci sphere,
  precomputed links, perspective projection — that pauses off-screen and when the tab is hidden.
  `ScoreOrb` and `AiOrb` build the gyroscope score display and the status-reactive interviewer orb.
- Print styles at the bottom of the file drive the report export (A4, 14 mm margins, hidden
  chrome, `print-color-adjust: exact` on chart bars and score chips).
- Theme switching uses the View Transitions API with a radial `clip-path` reveal expanding from
  the toggle button, falling back to a fading overlay layer where unsupported. A no-flash inline
  script in `index.html` applies the stored theme before first paint.

### Motion

The v2 UI layer is animation-led: a masked per-word headline reveal, a 3D point-cloud canvas
behind the hero, gyroscope score orbs, pointer-driven tilt/spotlight/magnetic surfaces, a sliding
sidebar highlight, and View-Transition page changes.

Reduced motion is therefore an explicit **preference**, not a by-product of the OS flag. On Windows
the flag behind `prefers-reduced-motion` is the global Explorer setting *"Animate controls and
elements inside windows"*, so honouring it unconditionally makes every animation silently vanish
for reasons unrelated to this app.

| Preference | Stored as | Behaviour |
| --- | --- | --- |
| **Full** (default) | `localStorage['synthview-motion'] = 'full'` | animations always on |
| **Reduced** | `'reduced'` | all motion off, content forced visible |
| **System** | `'system'` | follows `prefers-reduced-motion` |

[`src/lib/motion.ts`](src/lib/motion.ts) resolves the preference and writes `data-motion` onto
`<html>` — first from a no-flash inline script in `index.html`, then from `MotionProvider`. The CSS
block that disables motion is scoped to `:root[data-motion='reduced']`, so no media query can
override it in either direction. Visitors change it in **Settings → Preferences → Motion** or from
the command palette; `useTilt`, `useMagnetic` and `NeuralField` read the same resolution through
`shouldReduceMotion()`.

#### Smooth scrolling + scroll-driven animation (Lenis + GSAP)

Everything that reacts to scroll shares one clock:

- [`src/components/motion/smooth-scroll.tsx`](src/components/motion/smooth-scroll.tsx) owns a
  `Lenis` instance and drives it from the **GSAP ticker** (`autoRaf: false`), so scrub tweens never
  lag the scroll a frame. Lenis is mounted inside `<BrowserRouter>` (it resets scroll and refreshes
  ScrollTrigger per route) and only while the motion preference resolves to `full` — under
  `reduced` the page scrolls natively with every Lenis class stripped.
- [`src/lib/gsap.ts`](src/lib/gsap.ts) is the single `ScrollTrigger` registration point and a
  debug handle (`window.__sv.gsap` / `window.__sv.ScrollTrigger`, dev builds only).
- [`src/components/reveal.tsx`](src/components/reveal.tsx) rewires every entrance to ScrollTrigger
  (`once: true`, fired at the same threshold the old IntersectionObserver used) with an optional
  `stagger`/`staggerSelector` for cascading lists and card grids. Nothing is hidden in CSS — the
  "from" state lives only inside the tween, so content renders even if scripts never run.
- [`src/components/motion/split-text.tsx`](src/components/motion/split-text.tsx) drives the masked
  word-by-word hero reveal with a `power4.out` stagger instead of CSS keyframes.
- [`src/components/motion/parallax.tsx`](src/components/motion/parallax.tsx) (scrubbed drift),
  [`ScrollProgress`](src/components/scroll-progress.tsx) (page-wide scrub), fill-on-view
  [`Meter`](src/components/ui/meter.tsx), `AdaptiveExample` bar fills, and the sticky
  **"Inside the room"** walkthrough (steps highlight one at a time via `ScrollTrigger.create`)
  are all scrubbed or triggered off the same scroll source.
- [`SectionRail`](src/components/landing/section-rail.tsx) is a scroll-spy rail on the landing
  page (`xl:` screens): a band-anchored IntersectionObserver for the active dot, one-click Lenis
  glides to any section, offset below the fixed nav.
- Radix modal locks are enforced: a `MutationObserver` parks Lenis while any
  `data-scroll-locked` dialog/popover/select is open — without it Lenis scrolled pages behind
  modals. Inner scrollers (app sidebar, command palette list, notification list, select menus)
  opt out with `data-lenis-prevent`.
- Anchor clicks (`href="#…"`) glide via Lenis; if smooth scrolling is off they jump instantly but
  still land below the fixed header (`scroll-margin-top`).

### Base UI note

The spec called for `@base-ui/react` to provide the Button primitive. Base UI does not ship a
Button component, so `src/components/ui/button.tsx` implements it with `cva` + Radix `Slot`
(for `asChild`) and `forwardRef` (required because Radix triggers clone the child and attach a
ref). The exported `buttonVariants` keeps link-styled-as-button working. Everything else in the
Radix list is used as specified, and Radix `Popover` stands in for the notification bell.

## Project structure

```
src/
  App.tsx                    routes, guards (RequireAuth / RequireAdmin / GuestOnly), ThemedToaster
  index.css                  tokens, keyframes, utilities, print styles
  components/
    ui/                      button, panel, meter, badge, card, input, select, table, alert,
                             skeleton, dialog, tabs, count-up, misc (progress/separator/avatar)
    landing/                 hero, interview-demo, all remaining marketing sections
    auth/                    glass-card shell + login/register/verify, password card
    interview-room/          env check rows, camera tile, AI status bar, question panel + widgets
    motion/                  TiltCard/SplitText/Magnetic/Odometer primitives
    app-shell.tsx            sidebar (sliding highlight) + drawer + topbar (Outlet layout)
    neural-field.tsx         3D point-cloud canvas behind the hero
    score-orb.tsx, ai-orb.tsx  gyroscope score display + status-reactive interviewer orb
    command-palette.tsx      ⌘K palette (fuzzy scorer, grouped results)
    scroll-progress.tsx      scroll-position hairline
    motion-provider.tsx, theme-provider.tsx  preference providers (motion, theme)
    site-nav.tsx, site-footer.tsx, report-view.tsx, charts.tsx, reveal.tsx, …
  pages/                     landing, public-info, auth/, dashboard, interviews/,
                             analytics, profile, settings/, admin/
  lib/
    types.ts                 the domain model (Interview, Question, InterviewReport, events, …)
    format.ts                date/clock/score/band formatting + label maps
    constants/interview.ts   fields, topics, difficulty, duration, rounds, rules
    constants/live.ts        interview room status labels
    motion.ts                the motion preference: resolve, apply, shouldReduceMotion
    services/                mock-backed service modules (see below)
    stores/                  zustand: auth, live session, UI/notifications
  hooks/
    use-interview-socket.ts  mocked event emitter with a WebSocket-shaped API
    use-tilt.ts              useTilt / useSpotlight / useMagnetic pointer effects
    use-scroll-progress.ts   scroll progress, parallax, hotkeys
```

Routes: `/`, `/about`, `/contact`, `/privacy`, `/terms`, `/login`, `/register`,
`/forgot-password`, `/reset-password`, `/interviews/shared/:token`, `/dashboard`,
`/interviews`, `/interviews/new`, `/interviews/resumable`, `/interviews/:id`,
`/interviews/:id/lobby`, `/interviews/:id/live`, `/interviews/:id/completed`,
`/interviews/:id/history`, `/interviews/:id/metrics`, `/interviews/:id/report`, `/analytics`,
`/profile`, `/settings`, `/settings/sessions`, `/admin`, `/admin/users`, `/admin/interviews`,
`/admin/interviews/:id/report`, and `*` → 404.

## Swapping the mocks for a real API

The mock data is confined to `src/lib/services/`. Each module exports an object whose methods
are the contract the UI already depends on. Nothing else in `src/` imports the mock tables
directly.

| File | Contract |
| --- | --- |
| `services/interviews.ts` | `list`, `all`, `get`, `getByToken`, `resumable`, `questions`, `report`, `reportByToken`, `create`, `update`, `cancel`, `notifications`, `readNotification` |
| `services/analytics.ts` | `summary` |
| `services/admin.ts` | `stats`, `users`, `setStatus`, `setRole` |
| `services/auth.ts` | `authService.login/register/requestReset/resetPassword/verifyEmail`, `sessionService.list/revoke`, `contactService.send` |
| `services/mock-data.ts` | the seeded tables (`INTERVIEWS`, `ANALYTICS`, `ADMIN_USERS`, `PLATFORM_STATS`, `SESSIONS`, `NOTIFICATIONS`) and the question/report generators. **Delete this file once the real API is live.** |

### Steps

1. **Set the base URL.** Add `VITE_API_URL` to a `.env` file, e.g. `VITE_API_URL=http://localhost:8000/api`.

2. **Replace the method bodies.** Each method currently does `await sleep(n)` and returns an
   in-memory value. Swap in a fetch, keeping the signature and the returned type identical:

   ```ts
   // services/interviews.ts
   async list(filters: InterviewFilters = {}): Promise<Paginated<Interview>> {
     const params = new URLSearchParams(
       Object.entries(filters).flatMap(([k, v]) =>
         v === undefined || v === 'all' ? [] : [[k, String(v)]],
       ),
     )
     const res = await fetch(`${import.meta.env.VITE_API_URL}/interviews?${params}`)
     if (!res.ok) throw new Error('Failed to load interviews')
     return res.json()
   }
   ```

   Because every call already rejects on failure, the error states that already exist in the
   UI (`ErrorState`, `text-destructive` rows) start working without further changes.

3. **Delete the in-memory `table`/`notifications`/`users` variables** in each service and remove
   the `mock-data` import. `ReportUnavailableError` in `services/mock-data.ts` encodes one real
   product rule — *a report only exists once answers have been evaluated* — so keep an equivalent
   404 from the API and let the report page keep showing its empty state.

4. **Auth.** `useAuthStore` (`lib/stores/auth-store.ts`) persists a `User` to
   `localStorage['synthview-auth']`. Point `signIn`/`signUp` at your endpoints, store the token
   wherever you keep tokens, and have `RequireAuth`/`RequireAdmin` read the real session. The
   guards and the `GuestOnly` redirect need no change.

5. **Live interviews.** `hooks/use-interview-socket.ts` exports `MockInterviewSocket`, a tiny
   emitter with a scripted event sequence. Replace it with a class that owns a real `WebSocket`
   and keeps the same surface:

   ```ts
   on(listener: (event: InterviewEvent) => void): () => void
   connect(): void
   send(event: InterviewEvent): void
   close(): void
   ```

   `InterviewEvent` (in `lib/types.ts`) is already the wire format the room consumes —
   `status`, `question`, `transcript`, `evaluation`, `timer`, `connection`, `complete`. The room
   component subscribes through `useInterviewSocket(questions, enabled)` and reads
   `{ status, connection, streamed, evaluation, activeQuestion, complete, send }`, so streaming
   real transcripts and evaluations requires no component edits.

6. **Uploads and exports.** `report-view.tsx` builds the PDF client-side with `html2canvas` +
   `jsPDF`, and `navigator.clipboard` for share links. If you add server-side rendering, the
   export menu is the only thing that needs redirecting.

## Behaviour notes

- Every async view has a skeleton, an error state, and a dashed empty state with an icon chip,
  a heading, one sentence and a CTA.
- Every list/grid staggers in with `animate-rise-in` and `--stagger-i`; every page opens with
  `animate-slide-up`; below-the-fold marketing sections use the `Reveal` IntersectionObserver
  wrapper.
- Camera and microphone checks in the lobby call `getUserMedia` and fall back to an explicit
  `permission denied` / `no input device` state that shakes; the Start button springs in with a
  glow and stays disabled until both pass, then a rules dialog gates entry behind a 7-second
  countdown.
- The live room persists notes and answers in `useInterviewStore`, and a connection chip reports
  `connected` / `reconnecting` / `offline` instead of failing silently.
