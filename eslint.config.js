/**
 * Test-only rule overrides
 *
 * All TypeScript files under tests/ and JavaScript consumer programs under tests/consumers/
 *
 * functional/functional-parameters — disabled because vi.doMock() factory functions must match
 * the exact shape of the mocked module's API. Adding dummy parameters solely to satisfy the rule
 * would misrepresent those APIs.
 *
 * functional/no-conditional-statements — disabled because tests intentionally use explicit
 * control flow for assertions, mocks, and failure paths.
 *
 * functional/no-expression-statements and functional/no-return-void — disabled because Vitest
 * APIs such as describe(), it(), expect(), and vi.* register behavior through side effects and
 * void-returning callbacks.
 *
 * functional/no-throw-statements — disabled because mocks and test guards intentionally throw to
 * reproduce Node resolution failures and fail fast on invalid test state.
 *
 * tests/format.test.ts, tests/helpers/package-smoke.ts, the source setup script,
 * and tests/consumers/*.mjs
 *
 * security/detect-non-literal-fs-filename — disabled because these tests intentionally construct
 * filesystem paths from controlled fixture names and temporary directories. The paths are dynamic
 * by design but are not derived from untrusted input.
 *
 * scripts/setup-effect-reference.mjs and tests/consumers/*.mjs
 *
 * functional/no-promise-reject — disabled for native async programs that reject
 * when setup or consumer invariants fail.
 *
 * Effect harness and tests
 *
 * Effect services and schema errors use class-based factory APIs. Their Effect
 * parameters carry runtime internals, while service types combine
 * immutable data and operations. The harness overrides only the conflicting
 * functional rules. unicorn/throw-new-error mistakes Schema.TaggedError's
 * curried class factory for an Error constructor.
 */

import { createConfig } from "@cravingmaker/eslint-config";
import tseslint from "typescript-eslint";

import { effectStability } from "./scripts/eslint-rules/effect-stability.mjs";

const baseConfig = await createConfig({
  ignores: ["tests/fixtures/**/*", "repos/**"],
});

const config = [
  ...baseConfig,
  {
    files: [
      "index.mjs",
      "prettier.config.mjs",
      "eslint.config.js",
      "scripts/**/*.mjs",
      "tests/consumers/**/*.mjs",
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        // eslint-disable-next-line n/no-unsupported-features/node-builtins -- Development tooling requires Node >=22.22.1; dirname is stable there.
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: {
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
    },
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: "error",
      reportUnusedInlineConfigs: "error",
    },
  },
  {
    files: ["**/*.{js,mjs,ts}"],
    plugins: { local: { rules: { "effect-stability": effectStability } } },
    rules: {
      "local/effect-stability": "error",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              importNames: ["NodeChildProcessSpawner"],
              message:
                "Use the native Node command adapter; Effect's process API is unstable.",
              name: "@effect/platform-node-shared",
            },
          ],
          patterns: [
            {
              group: [
                "effect/process",
                "effect/process/**",
                "effect/unstable",
                "effect/unstable/**",
                "@effect/experimental",
                "@effect/experimental/**",
                "@effect/platform-node-shared/NodeChildProcessSpawner",
              ],
              message:
                "Use public, stable Effect APIs only; process execution belongs in the native Node adapter.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["tests/**/*.ts", "tests/consumers/**/*.mjs"],
    rules: {
      "functional/functional-parameters": "off",
      "functional/no-conditional-statements": "off",
      "functional/no-expression-statements": "off",
      "functional/no-return-void": "off",
      "functional/no-throw-statements": "off",
    },
  },
  {
    files: ["tests/format.test.ts"],
    rules: {
      "security/detect-non-literal-fs-filename": "off",
    },
  },
  {
    // Guard tests use controlled temporary projects and compiler filesystem hosts.
    files: ["tests/tooling-guards.test.ts"],
    rules: {
      "security/detect-non-literal-fs-filename": "off",
    },
  },
  {
    files: [
      "tests/helpers/package-smoke.ts",
      "tests/helpers/node-command.ts",
      "tests/package.smoke.test.ts",
    ],
    rules: {
      "functional/no-class-inheritance": "off",
      "functional/no-classes": "off",
    },
  },
  {
    files: ["tests/helpers/package-smoke.ts", "tests/helpers/node-command.ts"],
    rules: {
      "functional/no-mixed-types": "off",
      "functional/prefer-immutable-types": "off",
      "security/detect-non-literal-fs-filename": "off",
      "unicorn/throw-new-error": "off",
    },
  },
  {
    // Node event listeners maintain process state and bounded output buffers.
    files: ["tests/helpers/node-command.ts"],
    rules: {
      "functional/immutable-data": "off",
      "functional/no-let": "off",
      "functional/no-loop-statements": "off",
      "functional/no-promise-reject": "off",
    },
  },
  {
    files: ["scripts/setup-effect-reference.mjs"],
    rules: {
      "functional/no-promise-reject": "off",
      "security/detect-non-literal-fs-filename": "off",
    },
  },
  {
    files: ["tests/consumers/**/*.mjs"],
    rules: {
      "functional/no-promise-reject": "off",
      "security/detect-non-literal-fs-filename": "off",
    },
  },
];

// eslint-disable-next-line import-x/no-default-export -- ESLint configuration requires a default export
export default config;
