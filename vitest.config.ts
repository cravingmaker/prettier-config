import { configDefaults, defineConfig } from "vitest/config";

// eslint-disable-next-line import-x/no-default-export -- Vitest loads its project configuration through the default export
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "tests/fixtures/**", "repos/**"],
    include: ["tests/**/*.test.ts"],
  },
});
