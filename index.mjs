// @ts-check

import { lstatSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

// eslint-disable-next-line import-x/no-rename-default -- Use the plugin name instead of the bundled export identifier
import prettierPluginOxc from "@prettier/plugin-oxc";

const require = createRequire(import.meta.url);

/** @param {string} name */
const isOptionalPackageAbsent = (name) =>
  require.resolve.paths(name)?.every((directory) => {
    try {
      // eslint-disable-next-line n/no-sync, security/detect-non-literal-fs-filename -- Configuration loading is synchronous; inspect Node's lookup paths only after failed resolution.
      lstatSync(path.join(directory, name));
      return false;
    } catch (error) {
      // A directory entry (including a dangling symlink) means the installation
      // is present. Only ENOENT proves absence; other failures preserve resolution's error.
      return (
        error instanceof Error && "code" in error && error.code === "ENOENT"
      );
    }
  }) ?? false;

/** @param {string} name */
const resolveOptionalPlugin = (name) => {
  try {
    return [require.resolve(name)];
  } catch (error) {
    // Node also reports MODULE_NOT_FOUND without a path for installed packages
    // that have no entry point. Confirm absence without resolving package.json exports.
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "MODULE_NOT_FOUND" &&
      !("path" in error) &&
      isOptionalPackageAbsent(name)
    ) {
      return [];
    }
    throw error;
  }
};

const plugins = [
  prettierPluginOxc,
  require.resolve("prettier-plugin-packagejson"),
  require.resolve("prettier-plugin-toml"),
  require.resolve("@prettier/plugin-xml"),
  ...resolveOptionalPlugin("prettier-plugin-astro"),
  ...resolveOptionalPlugin("prettier-plugin-svelte"),
  // Tailwind plugin should always be last
  ...resolveOptionalPlugin("prettier-plugin-tailwindcss"),
];

/** @satisfies {import('prettier').Config} */
const config = {
  overrides: [
    {
      files: ["**/*.{ts,cts,mts,tsx}"],
      options: { parser: "oxc-ts" },
    },
    {
      files: ["**/*.{js,cjs,mjs,jsx}"],
      options: { parser: "oxc" },
    },
  ],
  plugins,
  singleAttributePerLine: true,
};

// eslint-disable-next-line import-x/no-default-export -- Prettier configuration is typically exported as a default export
export default config;
