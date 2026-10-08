import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

import config from "@cravingmaker/prettier-config";

import { consumerDirectory, format } from "./helpers.mjs";

const astro = await format(
  "example.astro",
  '---\nconst name="World"\n---\n<div class="p-4 flex">{name}</div>',
);
const svelte = await format(
  "example.svelte",
  '<script>let name="World"</script><div class="p-4 flex">{name}</div>',
);
const require = createRequire(path.join(consumerDirectory, "package.json"));
const configuredPlugins = (config.plugins ?? []).filter(
  (plugin) => typeof plugin === "string",
);
const modules = await fs.realpath(path.join(consumerDirectory, "node_modules"));

await Promise.all(
  configuredPlugins.map(async (plugin) => {
    const pluginPath = await fs.realpath(plugin);
    if (!pluginPath.startsWith(modules + path.sep)) {
      throw new Error(
        `Plugin resolved outside the consumer installation: ${plugin}`,
      );
    }
  }),
);

if (!configuredPlugins.includes(require.resolve("prettier-plugin-astro"))) {
  throw new Error("Astro plugin was not detected");
}

if (!configuredPlugins.includes(require.resolve("prettier-plugin-svelte"))) {
  throw new Error("Svelte plugin was not detected");
}

if (
  configuredPlugins.at(-1) !== require.resolve("prettier-plugin-tailwindcss")
) {
  throw new Error("Tailwind plugin was not loaded last");
}

if (!astro.includes('const name = "World";')) {
  throw new Error("Astro parser did not format the script");
}

if (!svelte.includes('let name = "World";')) {
  throw new Error("Svelte parser did not format the script");
}

if (!/class=["']flex p-4["']/.test(svelte)) {
  throw new Error(`Tailwind did not sort Svelte classes: ${svelte}`);
}

if (!/class=["']flex p-4["']/.test(astro)) {
  throw new Error(`Tailwind did not sort Astro classes: ${astro}`);
}

const vue = await format(
  "tailwind.vue",
  await fs.readFile(path.join(consumerDirectory, "tailwind.vue"), "utf8"),
);
if (
  !vue.includes(
    'class="custom-button flex rounded bg-blue-500 p-4 font-semibold text-white hover:bg-blue-700"',
  ) ||
  !vue.includes("'px-6 py-3 text-lg font-bold'") ||
  !vue.includes("'bg-black text-white': active") ||
  !vue.includes('data-label="text-white bg-black"') ||
  !vue.includes("@apply flex rounded bg-blue-500 p-4 text-white;")
) {
  throw new Error(
    `Tailwind did not sort Vue classes and scoped styles: ${vue}`,
  );
}

await Promise.all(
  ["tailwind.css", "tailwind.scss", "tailwind.less"].map(async (filename) => {
    const stylesheet = await format(
      filename,
      await fs.readFile(path.join(consumerDirectory, filename), "utf8"),
    );
    if (
      !stylesheet.includes(
        "@apply flex items-center rounded bg-blue-500 p-4 text-white hover:bg-blue-700;",
      ) ||
      !stylesheet.includes("@apply flex items-center px-4 py-2 !important;")
    ) {
      throw new Error(
        `Tailwind did not sort @apply utilities in ${filename}: ${stylesheet}`,
      );
    }
  }),
);

process.stdout.write("ok");
