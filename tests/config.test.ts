import { createRequire } from "node:module";

import prettierPluginOxc from "@prettier/plugin-oxc";
import { beforeEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);

// No lookup directory holds a package, so the runtime treats an optional plugin that does not resolve as absent.
const noLookupDirectories = () => {
  return [];
};

// Replaces Node's resolver for the next import of the runtime.
const mockResolve = (resolve: (name: string) => string) => {
  vi.doMock("node:module", () => {
    return {
      createRequire: () => {
        return {
          resolve: Object.assign(
            (name: string) => {
              return resolve(name);
            },
            { paths: noLookupDirectories },
          ),
        };
      },
    };
  });
};

describe("the shared config", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock("node:module");
  });

  it("sets only its documented options and loads the bundled plugins first", async () => {
    const { default: config } = await import("../index.mjs");
    const { plugins, ...options } = config;

    expect(options).toStrictEqual({
      overrides: [
        { files: ["**/*.{ts,cts,mts,tsx}"], options: { parser: "oxc-ts" } },
        { files: ["**/*.{js,cjs,mjs,jsx}"], options: { parser: "oxc" } },
        // Markdown only: YAML would join the lines of a multi-line value, such as a long workflow condition.
        { files: ["**/*.{md,markdown,mdx}"], options: { proseWrap: "never" } },
      ],
      printWidth: 150,
      singleAttributePerLine: true,
      tailwindFunctions: ["clsx", "cn", "cva", "classNames", "classnames", "tv"],
    });
    // Plugin paths resolve from the package, so a consumer's working directory cannot change them.
    expect(plugins.slice(0, 4)).toEqual([
      prettierPluginOxc,
      require.resolve("prettier-plugin-packagejson"),
      require.resolve("prettier-plugin-toml"),
      require.resolve("@prettier/plugin-xml"),
    ]);
  });

  it.each([
    { installed: [], label: "none" },
    { installed: ["astro"], label: "Astro" },
    { installed: ["svelte"], label: "Svelte" },
    { installed: ["tailwindcss"], label: "Tailwind" },
    { installed: ["astro", "svelte"], label: "Astro and Svelte" },
    { installed: ["astro", "tailwindcss"], label: "Astro and Tailwind" },
    { installed: ["svelte", "tailwindcss"], label: "Svelte and Tailwind" },
    { installed: ["astro", "svelte", "tailwindcss"], label: "all" },
  ])("includes exactly the installed optional plugins in order: $label", async ({ installed }) => {
    const optional = new Set(["prettier-plugin-astro", "prettier-plugin-svelte", "prettier-plugin-tailwindcss"]);
    mockResolve((name) => {
      if (optional.has(name) && !installed.includes(name.slice("prettier-plugin-".length))) {
        throw Object.assign(new Error("Not found"), { code: "MODULE_NOT_FOUND" });
      }
      return `/plugins/${name}.mjs`;
    });

    const { default: config } = await import("../index.mjs");

    expect(config.plugins).toEqual([
      prettierPluginOxc,
      "/plugins/prettier-plugin-packagejson.mjs",
      "/plugins/prettier-plugin-toml.mjs",
      "/plugins/@prettier/plugin-xml.mjs",
      ...installed.map((plugin) => {
        return `/plugins/prettier-plugin-${plugin}.mjs`;
      }),
    ]);
  });

  it.each([
    { error: { code: "ERR_INVALID_PACKAGE_CONFIG" }, label: "invalid package metadata" },
    { error: { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" }, label: "inaccessible package exports" },
    { error: { code: "EACCES" }, label: "a filesystem permission failure" },
    // eslint-disable-next-line no-undefined -- Exercise a resolver error with an explicitly undefined code.
    { error: { code: undefined }, label: "an unexpected resolver error" },
    // Node reports an installed package without its entry point with the path of the package's manifest.
    { error: { code: "MODULE_NOT_FOUND", path: "/plugins/prettier-plugin-astro/package.json" }, label: "a broken entry point" },
  ])("propagates the original error of an installed optional plugin for $label", async ({ error }) => {
    const failure = Object.assign(new Error("Cannot resolve optional plugin"), error);
    mockResolve((name) => {
      if (name === "prettier-plugin-astro") {
        throw failure;
      }
      return `/plugins/${name}.mjs`;
    });

    await expect(import("../index.mjs")).rejects.toBe(failure);
  });
});
