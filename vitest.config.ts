import { configDefaults, defineConfig } from "vitest/config";

// eslint-disable-next-line import-x/no-default-export -- Vitest loads its project configuration through the default export
export default defineConfig({
  test: {
    allowOnly: false,
    exclude: [...configDefaults.exclude, "tests/fixtures/**", "repos/**"],
    include: ["tests/**/*.test.ts"],
    // Files read through Prettier, the compiler, or consumer subprocesses are
    // outside Vitest's import graph. Keep their affected tests in watch mode.
    watchTriggerPatterns: [
      {
        pattern: /(?:^|\/)index\.mjs$/,
        testsToRun: (_filename) => [
          "tests/config.test.ts",
          "tests/format.test.ts",
          "tests/package.smoke.test.ts",
          "tests/tooling-guards.test.ts",
        ],
      },
      {
        pattern: /(?:^|\/)index\.d\.ts$/,
        testsToRun: (_filename) => ["tests/package.smoke.test.ts", "tests/tooling-guards.test.ts"],
      },
      {
        pattern: /(?:^|\/)tests\/fixtures\//,
        testsToRun: (_filename) => ["tests/format.test.ts", "tests/package.smoke.test.ts"],
      },
      {
        pattern: /(?:^|\/)tests\/consumers\//,
        testsToRun: (_filename) => "tests/package.smoke.test.ts",
      },
    ],
  },
});
