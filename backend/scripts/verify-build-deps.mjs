/**
 * Pre-build guard for `npm run build` (wired up as the `prebuild` script).
 *
 * `npm run build` is `tsc -p tsconfig.json`, so it needs the toolchain that
 * package.json deliberately keeps in devDependencies:
 *
 *   - `typescript` itself, and
 *   - `@types/node`, because tsconfig.json sets `"types": ["node"]`.
 *
 * Why this file exists: a host runs the build command exactly as configured, and
 * a build command of just `npm run build` installs nothing. tsc then comes from
 * the host's globally preinstalled TypeScript (Render's native runtimes ship one)
 * and compiles against an empty node_modules. TypeScript bails out on the very
 * first type library it cannot resolve, so the entire failure is reported as one
 * line that never mentions the missing install:
 *
 *     error TS2688: Cannot find type definition file for 'node'.
 *
 * This guard turns that situation into an explicit, actionable error instead. It
 * stays silent and cheap when the dependencies are present, so every caller of
 * `npm run build` (local, CI, Render) gets the same behaviour for free.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nodeModules = path.join(backendRoot, "node_modules");

// npm resolves `tsc` from node_modules/.bin, which is a symlink farm over the
// real file below, so this is the honest thing to check.
const typescriptEntry = path.join(nodeModules, "typescript", "bin", "tsc");

// TypeScript resolves the tsconfig `"types": ["node"]` entry by reading this
// directory's package.json `types` field and then that file. Checking that the
// directory merely exists is not enough: a partially extracted package fails the
// build in exactly the same way.
const typesNodeDir = path.join(nodeModules, "@types", "node");

function resolvedTypesEntry(dir) {
  const manifestPath = path.join(dir, "package.json");
  if (!existsSync(manifestPath)) return null;

  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const entry = manifest.types ?? manifest.typings ?? manifest.main;
    if (typeof entry !== "string" || entry.length === 0) return null;
    return existsSync(path.join(dir, entry)) ? entry : null;
  } catch {
    return null;
  }
}

const missing = [];
if (!existsSync(typescriptEntry)) missing.push("typescript");
if (resolvedTypesEntry(typesNodeDir) === null) missing.push("@types/node");

if (missing.length > 0) {
  process.stderr.write(
    [
      "",
      "✖ Build aborted: the backend's build toolchain is not installed.",
      `  Missing from node_modules: ${missing.join(", ")}`,
      "",
      "  `npm run build` is `tsc`, so dependencies must be installed first. A build",
      "  command of only `npm run build` installs nothing, and tsc then reports the",
      "  missing toolchain as one line that never mentions the install:",
      "",
      "      error TS2688: Cannot find type definition file for 'node'.",
      "",
      "  Fix the build command — backend/render.yaml `buildCommand`, or the Build",
      "  Command field in the Render Dashboard (a Dashboard value wins over the",
      "  Blueprint's, and only follows it on a Blueprint sync):",
      "",
      "      npm install --include=dev && npm run build",
      "",
      "  `--include=dev` is load-bearing: npm omits devDependencies whenever",
      "  NODE_ENV is `production`, and TypeScript plus @types/* live there.",
      "",
    ].join("\n") + "\n",
  );
  process.exit(1);
}
