// @ts-check

import { createRequire } from "node:module";

// eslint-disable-next-line import-x/no-rename-default -- Use the plugin name instead of the bundled export identifier
import prettierPluginOxc from "@prettier/plugin-oxc";

const require = createRequire(import.meta.url);

/** @param {string} name */
const resolveOptionalPlugin = (name) => {
  try {
    return [require.resolve(name)];
  } catch (error) {
    // Missing entry points also use MODULE_NOT_FOUND, but Node attaches the installed package path.
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "MODULE_NOT_FOUND" &&
      !("path" in error)
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
