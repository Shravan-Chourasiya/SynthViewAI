/**
 * Lean root-level suite — frontend half.
 *
 * This config deliberately *imports* `frontend/vitest.config.ts` instead of
 * restating it: the React plugin, the `@` → `frontend/src` alias, jsdom, the
 * MSW-backed setup file and the `VITE_*` environment all have to match the
 * app's real test environment, and the only way to guarantee that is to reuse
 * the project's own config rather than a copy that can drift.
 *
 * Bundling resolves each bare import from the file that contains it, so the
 * frontend config's own `import { defineConfig } from "vitest/config"` resolves
 * against `frontend/node_modules` even though the config is loaded from here.
 *
 * The same is NOT true for the test files in this directory: Node would resolve
 * their bare imports by walking up from `tests/frontend/` to the repo root,
 * where there is no `node_modules`. Hence the two catch-all alias rules below,
 * which point any bare package specifier at the frontend's copy. React in
 * particular must not be duplicated — a second copy would break hooks.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import base from "../../frontend/vitest.config";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const frontendModules = path.join(repoRoot, "frontend", "node_modules");

// Coverage thresholds are calibrated for the app's own suite; this lean layer
// is a smoke suite and is not meant to move that number, so the key is dropped
// entirely rather than left undefined (Vitest inspects `coverage.enabled`).
const { coverage: _coverage, ...baseTest } = base.test ?? {};

export default {
  ...base,
  resolve: {
    alias: [
      // Order matters: most specific first.
      { find: /^vitest$/, replacement: path.join(frontendModules, "vitest") },
      // Scoped packages, e.g. @testing-library/react (+ optional subpath).
      {
        find: /^(@[^/]+\/[^/]+)(\/.*)?$/,
        replacement: `${frontendModules}/$1$2`,
      },
      // Unscoped packages, e.g. react/jsx-dev-runtime (+ optional subpath).
      {
        find: /^([a-z0-9][^/]*)(\/.*)?$/,
        replacement: `${frontendModules}/$1$2`,
      },
      ...(base.resolve?.alias ? Object.entries(base.resolve.alias).map(([find, replacement]) => ({ find, replacement })) : []),
    ],
  },
  test: {
    ...baseTest,
    root: repoRoot,
    include: ["tests/frontend/**/*.test.tsx"],
    setupFiles: [path.join(repoRoot, "frontend", "vitest.setup.ts")],
  },
};
