import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Lean root-level suite — backend half.
 *
 * Two constraints shape this file, both verified by running it:
 *
 * 1. It deliberately does NOT `import { defineConfig } from "vitest/config"`.
 *    This file lives outside `backend/`, so a bare package import resolves from
 *    `tests/backend/` and walks up through `tests/` to the repo root — never
 *    reaching `backend/node_modules`, where vitest actually lives. The export
 *    below is a plain object, which Vitest accepts exactly like the result of
 *    `defineConfig`. Only builtins (`node:path`, `node:url`) are imported, and
 *    builtins always resolve.
 *
 * 2. There is no root package.json in this repo, so `tests/backend/*.test.ts`
 *    has the same problem for third-party imports. `vitest` itself is injected
 *    by the runner and resolves fine; anything else the suite imports (`supertest`
 *    today) must be aliased to its real location in `backend/node_modules`.
 *    Add one entry per package the new tests import — do not widen this to a
 *    catch-all pattern.
 *
 * Run with `npm run test:lean` from `backend/`.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const backendModules = path.join(repoRoot, "backend", "node_modules");

export default {
  resolve: {
    alias: [
      {
        find: /^supertest$/,
        replacement: path.join(backendModules, "supertest"),
      },
    ],
  },
  test: {
    root: repoRoot,
    environment: "node" as const,
    globals: false,
    include: ["tests/backend/**/*.test.ts"],
    testTimeout: 180_000,
    hookTimeout: 180_000,
    // Each file boots its own Postgres + Redis containers, so running files in
    // parallel would mean several concurrent container startups for a suite
    // that is small anyway. Sequential is the predictable trade.
    fileParallelism: false,
    // `isolate` is intentionally left at its default (true): every file gets a
    // fresh module registry, so `support.ts` can register its mocks and import
    // `app.js` again without inheriting the previous file's torn-down
    // containers.
    //
    // Reuses the existing env stubs verbatim rather than duplicating them.
    // Absolute, because a relative setupFile would resolve against the root above.
    // Order matters: the lean pins in `tests/backend/setup.ts` must land after
    // `backend/tests/setup.ts` so they win (see the comment in that file).
    setupFiles: [
      path.join(repoRoot, "backend", "tests", "setup.ts"),
      path.join(repoRoot, "tests", "backend", "setup.ts"),
    ],
  },
};
