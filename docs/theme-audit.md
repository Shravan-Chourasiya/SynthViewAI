# Theme and motion audit: frontend replacement

## Current `frontend/` theme-switch root-cause audit (before fix)

This section audits the active `frontend/` tree for the requested delayed theme
switch. The line references below were verified before source edits. This is a
separate scope from the historical `frontend-prev/` versus replacement snapshot
audit that follows.

### Confirmed root causes, ranked

1. **The document theme is applied in a passive effect.** `ThemeProvider` calls
   `apply(theme)` from `useEffect` and only then updates its `resolvedTheme`
   state (`frontend/src/components/theme-provider.tsx:59-63`). React may paint the
   new settings/control state before that effect applies `.dark`/`.light`, so
   document CSS can lag by a frame. The index bootstrap does set the root class
   before first paint (`frontend/index.html:21-35`), but runtime updates use a
   different timing path.
2. **Color consumers update in a second React effect.** Charts keep their own
   color state and reread CSS variables in `useEffect` after `resolvedTheme`
   changes (`frontend/src/components/charts.tsx:23-49`). The root class change,
   context update and Recharts props therefore occur in separate commits/frames.
   `App.tsx` also supplies Sonner's `theme` from context (`frontend/src/App.tsx:144-149`),
   while CodeMirror reads CSS variables directly (`frontend/src/components/interview-room/code-editor.tsx:63-89`);
   those widget strategies are not synchronized by one theme snapshot.
3. **Switch paths have different timing and durations.** The base stylesheet
   animates `html` background/color for 280ms
   (`frontend/src/index.css:173-178`); many controls have independent Tailwind
   transition durations. Only the native View Transitions path adds
   `.theme-switching`, and it removes it on `transition.finished`
   (`frontend/src/components/theme-provider.tsx:99-105`). The no-API fallback
   separately fades an overlay for 480ms and removes it after a 520ms JS timer
   (`frontend/src/components/theme-provider.tsx:32-45`); ordinary `setTheme`
   calls do not use either path. Thus unrelated elements can visibly finish at
   different times.
4. **Several JS-rendered colors are not CSS-token driven.** Charts use literal
   fallback colors and axis/grid colors (`frontend/src/components/charts.tsx:24-48`);
   the canvas uses literal fallback colors (`frontend/src/components/neural-field.tsx:73-81`);
   report capture forces white (`frontend/src/components/report-view.tsx:42`);
   and the PDF builder has a fixed RGB palette (`frontend/src/lib/pdf-export.ts:102-111`).
   Brand-mark SVG literals are fixed brand artwork rather than theme selection
   (`frontend/src/components/brand-mark.tsx:14-40`). These choices make JS or
   exported visuals differ from the active CSS theme.
5. **The transition CSS cannot guarantee a consistent switch.** The temporary
   suppression selector exists (`frontend/src/index.css:180-187`), but only the
   view-transition branch adds its class; no two-animation-frame teardown
   protocol is used. The reduced-motion duration rule is separate
   (`frontend/src/index.css:682-690`) and does not replace that inconsistent
   application path.

### Component timing table (pre-fix evidence)

| Component/file | Theme source before fix | Update timing | Likely lag |
|---|---|---|---|
| `ThemeProvider` / root `<html>` | React context state; `.dark`/`.light` applied in `useEffect` | Passive effect after commit | High: one paint may use prior tokens |
| `charts.tsx` | `useTheme` then locally stored CSS-variable values | second `useEffect` after context change | High: chart props can trail root class |
| Sonner toaster (`App.tsx`) | `resolvedTheme` context prop | provider state update | Medium; depends on provider's delayed state |
| CodeMirror editor | CSS variables in EditorView theme | browser style recalculation | Low once root class changes; not an explicit JS subscription |
| `report-view.tsx` / PDF | fixed white canvas capture and fixed jsPDF RGB palette | on export | High: output does not follow current theme |
| ordinary CSS/Tailwind components | semantic CSS variables plus `dark:` and per-control transitions | each style transition's own duration | High visual inconsistency during a switch |

No source files had been changed at the point of this diagnosis. The fix below
makes the root attribute the single live theme source, updates it before paint,
removes JS color fallbacks, synchronizes JS widgets through a shared
`useSyncExternalStore` snapshot, and temporarily suppresses transitions for two
animation frames on every theme change.

## Fix applied (current state of `frontend/`)

### How each requirement is met

1. **One theme writer, before paint.** The only runtime writer of the document
   theme is `applyRootTheme` in `frontend/src/components/theme-provider.tsx:9-14`,
   called from `useIsomorphicLayoutEffect` (`frontend/src/components/theme-provider.tsx:43-51`),
   so the class and `data-theme` change land in the same commit, before paint.
   The only other writer is the inline pre-paint script
   (`frontend/index.html:21-35`), which runs before first paint. A repository
   search finds no other `classList.toggle('dark'|'light')`, `dataset.theme` write
   or `synthview-theme` read outside those two files and `theme-context.ts`
   (storage access is guarded with `try/catch` at
   `frontend/src/components/theme-context.ts:21-29,64-73` and
   `frontend/src/components/theme-provider.tsx:46-50`). Components read the theme;
   none of them hold independent theme state.
2. **Colors come from CSS variables.** A search for `#hex`, `rgb(`, `hsl(` over
   `frontend/src/**/*.{ts,tsx}` returns only relative-color expressions built from
   tokens in the CodeMirror theme (`frontend/src/components/interview-room/code-editor.tsx:68-88`).
   `index.css` keeps concrete values only inside token declarations, including the
   brand marks and print palette (`frontend/src/index.css:13-19,81-82`). Charts take
   `var(--chart-1..5)` / `var(--grid-line)` / `var(--muted-foreground)` values
   (`frontend/src/components/charts.tsx:23-31`), the tooltip swatch picks a
   `bg-chart-N` class by matching those same variable references
   (`frontend/src/components/charts.tsx:35,48`), the canvas reads tokens with
   `getComputedStyle` on the document root (`frontend/src/components/neural-field.tsx:79`),
   report capture reads `--print-background` instead of forcing white
   (`frontend/src/components/report-view.tsx:42-46`), and the PDF builder re-reads
   the same tokens through `syncPdfPalette()` on every build
   (`frontend/src/lib/pdf-export.ts:180,848,890`).
3. **One transition protocol.** Every theme change goes through
   `withoutThemeTransitions` (`frontend/src/components/theme-provider.tsx:18-26`):
   it adds `.theme-switching`, commits, and removes the class after two
   `requestAnimationFrame` callbacks, guarded by a generation counter so overlapping
   switches cannot remove it early. The stylesheet honours it with
   `.theme-switching, .theme-switching * { transition: none !important }`
   (`frontend/src/index.css:208-211`). The View Transitions API is not used, so
   there is no browser-dependent branch to disagree with the fallback; the
   `prefers-reduced-motion` duration rules remain in `index.css`. The generation
   counter and two-frame teardown are also what the system-mode listener uses
   (`frontend/src/components/theme-provider.tsx:53-60`).
4. **JS widgets share one snapshot.** `useTheme` is backed by
   `useSyncExternalStore` over `subscribeTheme` / `getThemeSnapshot`
   (`frontend/src/components/theme-context.ts:74-80`), and `applyRootTheme`
   publishes the snapshot in the same layout effect that changes the document, so
   subscribers re-render in that commit. Consumers: the toaster
   (`frontend/src/App.tsx:143-147`), charts (`frontend/src/components/charts.tsx:23-31`),
   the canvas, which both calls `useTheme()` and subscribes for redraw
   (`frontend/src/components/neural-field.tsx:51,212`), and the toggle
   (`frontend/src/components/theme-toggle.tsx:13`). CodeMirror needs no
   subscription: its theme is static `var(--...)` declarations that the browser
   re-resolves when the root class changes.
5. **No flash, live system mode.** The pre-paint script resolves `dark | light |
   system` (including `prefers-color-scheme`) before first paint
   (`frontend/index.html:21-35`); the provider re-applies the same result in its
   layout effect and early-returns when nothing changed
   (`frontend/src/components/theme-provider.tsx:43-51`; snapshot equality guard at
   `frontend/src/components/theme-context.ts:58-63`). The `system` choice installs a
   `matchMedia` listener that applies the resolved theme through the same
   suppression path (`frontend/src/components/theme-provider.tsx:53-60`).

### Post-fix component table

| Component/file | How it reads the theme | Transition timing | Likely lag |
|---|---|---|---|
| Root `<html>` | written once by `applyRootTheme` in a layout effect (+ pre-paint script) | instant; all transitions suppressed for 2 frames | none |
| Toaster (`App.tsx:143-147`) | `useTheme()` → `useSyncExternalStore` | same commit as the root class | none |
| Charts (`charts.tsx:23-31,48`) | `useTheme()` + `var(--chart-N)` strings passed to Recharts | same commit; SVG resolves CSS vars | none |
| Neural canvas (`neural-field.tsx:51,79,212`) | `useTheme()` + `subscribeTheme` redraw | redraw on the snapshot publish | none |
| CodeMirror (`code-editor.tsx:68-88`) | static `var(--...)` declarations | browser style recalculation | none |
| Report capture (`report-view.tsx:42-46`) | reads `--print-background` at export time | n/a (event-driven) | none |
| PDF export (`pdf-export.ts:180,848,890`) | `syncPdfPalette()` reads tokens at build time | n/a (event-driven) | none |
| Ordinary CSS/Tailwind components | semantic tokens + `dark:` variants | transitions disabled during the switch | none |
| Theme toggle button itself | `text-muted-foreground` + Button `transition-all duration-200` | its own 200 ms hover transition runs after the pointer leaves | visual only on the control, not a theme lag |

### Accepted exceptions

- `frontend/public/brand-mark.svg` keeps fixed brand hex stops. It is loaded as an
  image (favicon), so CSS variables are unavailable to it; the in-app
  `BrandMark` component uses `--brand-mark-*` tokens instead
  (`frontend/src/components/brand-mark.tsx:12-29`).
- Print/PDF colors are concrete values by nature (jsPDF cannot parse `oklch()`),
  but they are declared once as `--print-background` / `--print-foreground` tokens
  per theme (`frontend/src/index.css:18-19,81-82`) and read back at export time.

### Verification performed

- `npx tsc --noEmit` → exit 0.
- `npx vitest run src/__tests__/unit/components/theme-provider.test.tsx src/__tests__/unit/lib/pdf-export.test.ts`
  → 17/17 passing. The provider test now covers pre-paint application, the
  before-paint toggle with two-frame suppression teardown, storage failure, and
  live system-mode changes  (`frontend/src/__tests__/unit/components/theme-provider.test.tsx:63-104`).
- `npx playwright test e2e/theme.spec.ts` → 6/6 passing: three pages sample 40
  computed-color elements one frame after a toggle and require exact equality with
  a page loaded directly in that theme; a reload test asserts the stored theme is
  the first painted frame with no later correction; a second reload asserts the
  default is dark; a system test flips the OS scheme live.
- Two harness details are load-bearing and documented in the spec: the reload test
  defers its instrumentation to the first `requestAnimationFrame` because
  `document.documentElement` does not exist when an init script first runs, and the
  toggle test lets the Button's own 200 ms hover transition come to rest after the
  pointer leaves before sampling (`frontend/e2e/theme.spec.ts:35-57`).
- `npx eslint` on the touched files: no new problems from this change. It reports
  two pre-existing errors in `pdf-export.ts` (`no-misleading-character-class` at
  line 248, `no-control-regex` at line 257, both in `GLYPH_FALLBACKS`/`pdfSafe`,
  untouched by this work) and one pre-existing `react-refresh/only-export-components`
  warning for the `useTheme` re-export in `theme-provider.tsx:3`.

## Evidence scope

This audit compares the preserved baseline at [`frontend-prev/`](../frontend-prev/)
with the approved replacement snapshot stored in `new-frontend-git-backup` at
commit `ad66e054216fa17d84e2d4080e16bb058cb23caf`. The requested
`new-frontend/` checkout directory is absent. Target paths/line numbers refer to
that exact commit and can be reproduced with
`git --git-dir=new-frontend-git-backup show ad66e054:<path> | nl -ba`.
The current `frontend/` is a partially changed worktree, not the baseline for
this comparison. This is a source review, not a rendered visual, color-contrast,
or WCAG conformance test. No theme or source files were modified for this audit.

## Executive summary

The replacement retains the same cool blue-slate light/dark token palette and
adds an explicit `system` option, system-preference change tracking, reduced
motion behavior for the theme toggle, and a no-View-Transitions overlay
fallback. The prior app also had a reduced-motion stylesheet, theme toggle and
radial transition, so these are evolutions rather than brand-new themes. The
replacement includes a broader motion vocabulary and a global reduced-motion
rule, but the CSS rule and runtime behavior are not fully aligned: the theme
provider still runs its overlay fallback when View Transitions are unavailable,
even when reduced motion is requested; the CSS disables animations, but not the
provider's 520ms overlay timeout. The replacement also omits the `@font-face`
source aliases in CSS but supplies the same external Google Fonts in `index.html`
(unverified in this output only for successful network loading). Neither source
review establishes actual color contrast or PDF rendering.

## 1. Theme tokens and color modes

### Shared palette

Both trees define light and dark values for background, foreground, card,
popover, primary, secondary, muted, accent, destructive, border and focus ring,
plus signal, chart and sidebar tokens. The baseline defines them in
`frontend-prev/src/index.css:79-130,133-183`; the replacement defines them in
`new-frontend/src/index.css:11-63,65-114`. The literal core light/dark values
match in the inspected ranges; the target reorganizes the CSS so tokens precede
Tailwind's `@theme inline` block (`new-frontend/src/index.css:116-171`), while
baseline maps semantic font aliases and tokens together
(`frontend-prev/src/index.css:19-77`).

Both use `oklch(...)` CSS colors, including translucent borders and signal/chart
colors (baseline `frontend-prev/src/index.css:84-130,137-183`; target
`new-frontend/src/index.css:13-60,66-113`). This source comparison does not
verify browser support or component-by-component contrast. Do not claim WCAG
contrast compliance without testing each foreground/background pair in its
rendered state.

### Theme choices and persistence

- Baseline supports only `dark | light`; its provider starts dark, reads and
  writes `synthview-theme`, applies `.dark` / `.light` and updates
  `color-scheme` (`frontend-prev/src/components/theme-provider.tsx:10-30,33-49,51-61`).
  The inline bootstrap reads the same storage key before first paint and defaults
  to dark (`frontend-prev/index.html:19-35`).
- Target's `Theme` type is `dark | light | system`, reads the same storage key,
  detects OS dark preference, updates when `prefers-color-scheme` changes and
  resolves that choice into `.dark` / `.light`
  (`new-frontend/src/components/theme-context.ts:1-10`;
  `new-frontend/src/components/theme-provider.tsx:4-26,44-68`). Its inline
  bootstrap also checks system preference before first paint
  (`new-frontend/index.html:22-31`).
- Target settings offers Dark, Light and System controls and describes System as
  following the OS setting (`new-frontend/src/pages/settings/index.tsx:142-169`).
  The baseline did not expose a system preference option in its two-value
  context/toggle (`frontend-prev/src/components/theme-provider.tsx:10-20,112-114`).
- Target theme toggle's accessible name reports the next theme action, and it
  passes pointer coordinates for a radial reveal (`new-frontend/src/components/theme-toggle.tsx:6-27`).
  Baseline toggle similarly labels the next action and computes the button-center
  origin (`frontend-prev/src/components/theme-toggle.tsx:5-21`).

**Persistence caveat:** both providers call `localStorage` directly during theme
read/write. Baseline catches write failures inside its commit function but its
initial read is not guarded in the provider (`frontend-prev/src/components/theme-provider.tsx:41-48,53-60`);
target `readStored` and the effect's write are also not caught
(`new-frontend/src/components/theme-provider.tsx:10-14,56-60`). The target HTML
bootstrap catches errors around its initial access (`new-frontend/index.html:22-31`),
but provider access still exists after load. Behavior when storage access throws
is therefore **unverified** and should be tested in restricted/private contexts.

## 2. Theme transitions and reduced motion

### Transition implementations

- Baseline uses the View Transitions API when available; otherwise it reads the
  next CSS color and mounts a radial overlay, then commits the theme and removes
  the layer after a sequence ending at 960 ms (`frontend-prev/src/components/theme-provider.tsx:63-109`).
  CSS defines both the native view transition and overlay radial reveal
  (`frontend-prev/src/index.css:198-231`).
- Target uses the View Transitions API when available; if absent, it appends an
  overlay and fades opacity over 480 ms, removing it after 520 ms
  (`new-frontend/src/components/theme-provider.tsx:29-42`). On supported
  browsers it uses the pointer as the radial origin and applies the new theme
  inside `startViewTransition` (`:72-99`). The CSS defines the native radial
  reveal and fallback layer (`new-frontend/src/index.css:589-622`).

### Reduced-motion behavior

The baseline CSS disables selected reveal, ambient and one-shot motion under
`prefers-reduced-motion: reduce` (`frontend-prev/src/index.css:546-571`). The
baseline provider does not itself check that preference before launching its
view-transition or fallback overlay (`frontend-prev/src/components/theme-provider.tsx:63-109`).

The target provider detects reduced motion and skips the native radial
transition when the browser supports the View Transitions API
(`new-frontend/src/components/theme-provider.tsx:72-87`). Its CSS also reduces
all animation/transition duration and disables selected entrance animations
(`new-frontend/src/index.css:624-656`). **Gap:** if View Transitions are not
available, `toggle` takes the `!supports` fallback before the reduced-motion
branch and always starts `overlayFallback`; that means the fallback fade remains
active for a reduced-motion user (`new-frontend/src/components/theme-provider.tsx:72-87`,
`:29-42`). The CSS duration rule affects CSS transitions, but the overlay's
removal also uses a JavaScript 520ms timer (`:38-41`). Consider checking reduced
motion before either animation path and committing the theme directly.

The new global reduced-motion CSS is broader than the baseline's selective
rules, but it does not prove every non-CSS animation path respects that setting.
For example, the evidence reviewed here is insufficient to verify every use of
GSAP or any future imperative animation. Audit those call sites if they are
used; do not infer their runtime handling from the stylesheet alone.

## 3. Motion-system changes

The target stylesheet adds a named motion system with keyframes such as reveal,
fade-in, slide-up, scale-in, rise-in, glow-pulse, ambient-drift and focus-pulse,
plus reusable `.animate-*` utilities (`new-frontend/src/index.css:242-568`).
The baseline also has reusable animation utilities including reveal, fade,
slide, scale, shimmer, glow-pulse, lobby one-shots, list entrance and focus
pulses (`frontend-prev/src/index.css:354-467,476-544`). The core interaction
vocabulary is therefore retained but expanded/renamed in places; target-only
utilities such as pulse-dot, typing-bar, flow-dash, float-y, scan and count-up
are defined in the target stylesheet (`new-frontend/src/index.css:426-486,548-568`).

The replacement's package manifest lists no GSAP or Lenis dependencies
(`new-frontend/package.json:13-53`), and the target commit has no
`src/components/motion-provider.tsx` or `src/lib/motion.ts`. Although the
previous incomplete checkout iteration contained files with those names, those
files are not part of the approved target commit. Any claim that this replacement
ships those runtime systems is **unverified/unsupported** by the snapshot.

### Animation caveats

- Target `prefers-reduced-motion` applies a global near-zero duration and then
  disables several named entrance animations (`new-frontend/src/index.css:628-656`),
  while infinite utility animations such as shimmer, typing caret and status
  indicators are not explicitly all set to `animation: none` in the selector
  list. The global iteration cap limits animation duration, but a rendered
  usability check is needed to confirm any indicator semantics and remaining
  imperative animations.
- Target `hero.tsx` uses `animate-ping` and `animate-glow-pulse`
  (`new-frontend/src/components/landing/hero.tsx:25,82`), and its landing sections
  include a repeating typing bar and glow animation
  (`new-frontend/src/components/landing/sections.tsx:203-204,635`). Both classes
  are CSS animations subject to the media query's global duration cap; whether
  motion is imperceptible under all browsers is not established without rendering.
- Baseline lobby animation rules explicitly keep functional spinners while
  disabling decorative effects in reduced motion
  (`frontend-prev/src/index.css:556-571`). Target's replacement media query should
  receive equivalent semantic review to ensure progress feedback stays perceivable
  after animations are removed.

## 4. Typography and presentation assets

The baseline CSS aliases Inter and JetBrains Mono through `--font-inter` and
`--font-jetbrains-mono` and maps them to Tailwind's sans/mono families
(`frontend-prev/src/index.css:19-28`); its HTML loads both families from Google
Fonts (`frontend-prev/index.html:12-17`). The target maps the same family names
directly to the Tailwind font tokens (`new-frontend/src/index.css:116-121`), and
its HTML also includes a theme-color metadata tag and no-flash boot script
(`new-frontend/index.html:12,22-31`). Actual font request success, fallback
rendering, and any image crop/artifact are **unverified** without browser output.

The target report export dynamically loads html2canvas and jsPDF, captures the
report root as a canvas and places that image into a PDF
(`new-frontend/src/components/report-view.tsx:66-80`). The baseline has a
purpose-built code-aware PDF exporter with a documented conversion for its
OKLCH theme colors (`frontend-prev/src/lib/pdf-export.ts:30`, code answer block
and "Code was reviewed, not executed" at `:643-651`). The target report view
export does not use that specialized module and no code-answer block exists in
the target snapshot. Preserve the baseline code block in the migrated PDF; the
image export is a different path, not parity. Visual correctness of either PDF
is not asserted by this audit.

## 5. Verified migration actions

1. Keep the existing light/dark token values and the `synthview-theme` key if
   retaining existing user preference is required; the replacement already uses
   that key (`frontend-prev/src/components/theme-provider.tsx:23`;
   `new-frontend/src/components/theme-provider.tsx:4`). Decide explicitly
   whether to support the target's added System mode.
2. Move the reduced-motion check ahead of both theme-transition paths, including
   the unsupported-API overlay fallback; test with and without View Transitions.
3. Preserve functional state indicators and static visibility when turning off
   decoration, and verify CSS plus imperative animations under a reduced-motion
   preference.
4. Bring over the baseline's specialized PDF implementation alongside the new
   presentation rather than treating screenshot export as a replacement for
   code-answer rendering.
5. Render representative pages in light/dark/system modes at desktop/mobile
   sizes, then measure contrast for text, focus indicators, muted labels and
   status colors. These render and contrast checks have not been performed.

## 6. Verification limits

This document is a static source audit. It does not claim screenshots, browser
rendering, route-by-route visual parity, contrast measurements, accessibility
conformance, font network availability, reduced-motion runtime success, or PDF
output correctness. Those checks require a checked-out runnable target and are
still unverified.
