import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Focused tests fail locally as well as in CI, so a pre-push run cannot skip the suite.
    allowOnly: false,
    // Raw formatter inputs are never tests.
    exclude: [...configDefaults.exclude, "tests/fixtures/**"],
    // A test that asserts nothing would pass vacuously.
    expect: { requireAssertions: true },
    include: ["tests/**/*.test.ts"],
    // With `unstubEnvs` and `unstubGlobals`, each test starts with the real implementations,
    // environment variables, and globals. Vitest already clears the calls that mocks recorded.
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    // Files read through Prettier, the compiler, or child processes are
    // outside Vitest's import graph. Keep their affected tests in watch mode.
    watchTriggerPatterns: [
      {
        pattern: /(?:^|\/)index\.mjs$/u,
        testsToRun: (_filename) => {
          return ["tests/config.test.ts", "tests/format.test.ts", "tests/package.test.ts"];
        },
      },
      {
        pattern: /(?:^|\/)index\.d\.ts$/u,
        testsToRun: (_filename) => {
          return ["tests/package.test.ts"];
        },
      },
      {
        pattern: /(?:^|\/)tests\/fixtures\//u,
        testsToRun: (_filename) => {
          return ["tests/format.test.ts", "tests/package.test.ts"];
        },
      },
      {
        pattern: /(?:^|\/)tests\/consumers\//u,
        testsToRun: (_filename) => {
          return ["tests/package.test.ts"];
        },
      },
      {
        pattern: /(?:^|\/)scripts\/check-workflows\.mjs$/u,
        testsToRun: (_filename) => {
          return ["tests/workflow-tool.test.ts"];
        },
      },
    ],
  },
});
