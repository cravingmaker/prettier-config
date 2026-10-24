import { configDefaults, defineConfig } from "vitest/config";

// eslint-disable-next-line import-x/no-default-export -- Vitest loads its project configuration through the default export
export default defineConfig({
  test: {
    // Focused tests fail locally as well as in CI, so a pre-push run cannot skip the suite.
    allowOnly: false,
    // Raw formatter inputs and read-only upstream references are never tests.
    exclude: [...configDefaults.exclude, "tests/fixtures/**", "repos/**"],
    // A test that asserts nothing would pass vacuously.
    expect: { requireAssertions: true },
    include: ["tests/**/*.test.ts"],
    // With `unstubEnvs` and `unstubGlobals`, each test starts with the real implementations,
    // environment variables, and globals. Vitest already clears the calls that mocks recorded.
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    // Files read through Prettier, the compiler, or consumer subprocesses are
    // outside Vitest's import graph. Keep their affected tests in watch mode.
    watchTriggerPatterns: [
      {
        pattern: /(?:^|\/)index\.mjs$/,
        testsToRun: (_filename) => ["tests/config.test.ts", "tests/format.test.ts", "tests/package.smoke.test.ts", "tests/tooling-guards.test.ts"],
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
