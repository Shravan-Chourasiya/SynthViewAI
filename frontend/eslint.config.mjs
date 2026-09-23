import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

/**
 * Frontend lint configuration.
 *
 * Deliberately mirrors `backend/eslint.config.mjs` so both halves of the project
 * are held to the same standard: `js.configs.recommended` plus typescript-eslint's
 * recommended/stylistic rule sets, with the same three local overrides
 * (`no-unused-vars` as a warning with `_`-prefix opt-outs, `no-explicit-any` as a
 * warning rather than an error, and type-only imports required to be written as
 * `import type`).
 *
 * Unlike the backend this is NOT type-aware (`recommendedTypeChecked`). Type-aware
 * linting needs every linted file to belong to a tsconfig project, and the suite
 * files under `src/__tests__` rely heavily on `as any` casts for test doubles,
 * which would drown the report in `no-unsafe-*` noise. `npm run build` already
 * runs `tsc -p tsconfig.check.json`, so type *errors* are still caught — this
 * config covers the syntax/style/React-hooks layer.
 */
export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "public/**",
    ],
  },

  js.configs.recommended,

  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,

  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
    },
  },

  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    ...tseslint.configs.disableTypeChecked,
  },

  eslintConfigPrettier,
);
