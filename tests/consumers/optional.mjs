import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

import config from "@cravingmaker/prettier-config";

import { consumerDirectory, format, verifyPluginPaths, verifyPrettierVersion } from "./helpers.mjs";

verifyPrettierVersion();
await verifyPluginPaths();

const require = createRequire(path.join(consumerDirectory, "package.json"));
const plugins = config.plugins.filter((plugin) => {
  return typeof plugin === "string";
});
assert.ok(plugins.includes(require.resolve("prettier-plugin-astro")), "Astro plugin was not detected");
assert.ok(plugins.includes(require.resolve("prettier-plugin-svelte")), "Svelte plugin was not detected");
assert.equal(plugins.at(-1), require.resolve("prettier-plugin-tailwindcss"), "Tailwind plugin was not loaded last");

const astro = await format("example.astro", '---\nconst name="World"\n---\n<div class="p-4 flex">{name}</div>');
assert.ok(astro.includes('const name = "World";'), astro);
assert.match(astro, /class=["']flex p-4["']/u);

const svelte = await format("example.svelte", '<script>let name="World"</script><div class="p-4 flex">{name}</div>');
assert.ok(svelte.includes('let name = "World";'), svelte);
assert.match(svelte, /class=["']flex p-4["']/u);

await Promise.all(
  ["clsx", "cn", "cva", "classNames", "classnames", "tv"].flatMap((name) => {
    return [
      { extension: "js", parser: "oxc" },
      { extension: "ts", parser: "oxc-ts" },
    ].map(async ({ extension, parser }) => {
      const argument = name === "tv" ? '{base:"text-white p-4 flex"}' : '"text-white p-4 flex"';
      const formatted = await format(`tailwind-functions/${name}.${extension}`, `${name}(${argument})`, parser);
      assert.ok(formatted.includes('"flex p-4 text-white"'), formatted);
    });
  }),
);

const vue = await format("tailwind.vue", await fs.readFile(path.join(consumerDirectory, "tailwind.vue"), "utf8"));
const vueFragments = [
  'class="custom-button flex rounded bg-blue-500 p-4 font-semibold text-white hover:bg-blue-700"',
  "'px-6 py-3 text-lg font-bold'",
  "'bg-black text-white': active",
  'data-label="text-white bg-black"',
  "@apply flex rounded bg-blue-500 p-4 text-white;",
];
assert.deepEqual(
  vueFragments.filter((fragment) => {
    return !vue.includes(fragment);
  }),
  [],
  `Tailwind did not sort Vue classes and scoped styles: ${vue}`,
);

await Promise.all(
  ["tailwind.css", "tailwind.scss", "tailwind.less"].map(async (filename) => {
    const stylesheet = await format(filename, await fs.readFile(path.join(consumerDirectory, filename), "utf8"));
    assert.ok(stylesheet.includes("@apply flex items-center rounded bg-blue-500 p-4 text-white hover:bg-blue-700;"), stylesheet);
    assert.ok(stylesheet.includes("@apply flex items-center px-4 py-2 !important;"), stylesheet);
  }),
);

process.stdout.write("ok");
