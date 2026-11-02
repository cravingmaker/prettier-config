/**
 * Repository rule overrides
 *
 * Tests: all TypeScript files under tests/ and the consumer programs under tests/consumers/
 *
 * functional/functional-parameters — disabled because vi.doMock() factory functions must match
 * the exact shape of the mocked module's API. Adding dummy parameters solely to satisfy the rule
 * would misrepresent those APIs.
 *
 * functional/no-conditional-statements — disabled because tests intentionally use explicit control flow for assertions, mocks, and failure paths.
 *
 * functional/no-expression-statements and functional/no-return-void — disabled because Vitest
 * APIs such as describe(), it(), expect(), and vi.* register behavior through side effects and
 * void-returning callbacks.
 *
 * functional/no-throw-statements — disabled because mocks and test guards intentionally throw to reproduce Node resolution failures and fail fast on invalid test state.
 *
 * Tests, consumer programs, and scripts
 *
 * functional/no-promise-reject — disabled because these asynchronous programs reject when a tool or consumer invariant fails.
 *
 * security/detect-non-literal-fs-filename — disabled because these programs build filesystem paths from fixed fixture names and the temporary or cache directories that they own. The paths are dynamic by design but are not derived from untrusted input.
 */

import { createConfig } from "@cravingmaker/eslint-config";
import tseslint from "typescript-eslint";
import plugin from "@vitest/eslint-plugin";

const baseConfig = await createConfig({
  ignores: ["tests/fixtures/**/*"],
  // Svelte is installed for Prettier fixtures, which ESLint does not lint.
  svelte: false,
  typescript: { typeChecked: true },
});

const config = [
  ...baseConfig,
  {
    files: ["index.mjs", "prettier.config.mjs", "eslint.config.js", "scripts/**/*.mjs", "tests/consumers/**/*.mjs"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        // eslint-disable-next-line n/no-unsupported-features/node-builtins -- Development tooling requires Node >=24.15.0; dirname is stable there.
        tsconfigRootDir: import.meta.dirname,
      },
    },
    name: "@cravingmaker/prettier-config/type-aware-javascript",
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
    name: "@cravingmaker/prettier-config/linter-options",
  },
  {
    files: ["**/*.{js,mjs,cjs,jsx,mjsx,ts,mts,cts,tsx,mtsx}"],
    name: "@cravingmaker/prettier-config/unicorn-overrides",
    rules: {
      "unicorn/name-replacements": [
        "error",
        {
          allowList: {
            i18n: true,
            i18nKey: true,
            tsconfigRootDir: true,
          },
          ignore: [String.raw`\.spec$`, String.raw`\.test$`, String.raw`\.e2e$`],
          replacements: {
            ctx: false,
            e: { error: true, event: false },
            fn: { function: false },
            ref: false,
            repository: false,
            req: false,
            res: false,
          },
        },
      ],
      "unicorn/no-asterisk-prefix-in-documentation-comments": "off",
      "unicorn/no-unused-array-method-return": "off",
      "unicorn/prefer-error-is-error": "off",
      "unicorn/prefer-simple-condition-first": "off",
      "unicorn/single-line-block-comment-style": "off",
    },
  },
  {
    // Focused tests also fail at run time (`allowOnly: false`). Skipped, pending, and conditional
    // tests need a local rule exception that explains why their coverage is disabled.
    files: ["tests/**/*.test.ts"],
    name: "@cravingmaker/prettier-config/vitest",
    plugins: { vitest: plugin },
    rules: {
      "no-restricted-properties": [
        "error",
        ...["describe", "it", "test"].flatMap((object) => {
          return ["runIf", "skipIf"].map((property) => {
            return { message: "Conditional tests need a local rule exception that explains why their coverage is disabled.", object, property };
          });
        }),
      ],
      "vitest/no-disabled-tests": "error",
      "vitest/no-focused-tests": ["error", { fixable: false }],
      "vitest/require-awaited-expect-poll": "error",
      "vitest/valid-expect": "error",
      "vitest/valid-expect-in-promise": "error",
      "vitest/warn-todo": "error",
    },
  },
  {
    // Test registration groups and fixture tables describe the test hierarchy rather than runtime complexity.
    files: ["tests/**/*.test.ts"],
    name: "@cravingmaker/prettier-config/test-structure",
    rules: {
      "max-lines-per-function": "off",
      "max-nested-callbacks": "off",
    },
  },
  {
    files: ["tests/**/*.ts", "tests/consumers/**/*.mjs"],
    name: "@cravingmaker/prettier-config/test-overrides",
    rules: {
      "functional/functional-parameters": "off",
      "functional/no-conditional-statements": "off",
      "functional/no-expression-statements": "off",
      "functional/no-return-void": "off",
      "functional/no-throw-statements": "off",
    },
  },
  {
    files: ["tests/**/*.ts", "tests/consumers/**/*.mjs", "scripts/**/*.mjs"],
    name: "@cravingmaker/prettier-config/tests-and-scripts",
    rules: {
      "functional/no-promise-reject": "off",
      "security/detect-non-literal-fs-filename": "off",
    },
  },
];

export default config;
