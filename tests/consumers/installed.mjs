import assert from "node:assert/strict";
import process from "node:process";

import config from "@cravingmaker/prettier-config";

import { format, verifyPluginPaths } from "./helpers.mjs";

await verifyPluginPaths();
const oxc = await import("@prettier/plugin-oxc");
assert.equal(config.plugins[0], oxc.default);
const optionalPlugins = [
  "prettier-plugin-astro",
  "prettier-plugin-svelte",
  "prettier-plugin-tailwindcss",
];
assert.deepEqual(
  optionalPlugins.filter((name) =>
    config.plugins.some(
      (plugin) => typeof plugin === "string" && plugin.includes(name),
    ),
  ),
  [],
);

const examples = [
  {
    expected: "<config><item name='fixture' /></config>\n",
    filename: "nested/config.xml",
    source: "<config><item name='fixture'/></config>",
  },
  {
    expected: 'const greeting = "hello";\n',
    filename: "src/example.js",
    parser: "oxc",
    source: 'const greeting="hello"',
  },
  {
    expected: 'const greeting: string = "hello";\n',
    filename: "src/example.ts",
    parser: "oxc-ts",
    source: 'const greeting:string="hello"',
  },
  {
    expected: 'const element = <div className="greeting">Hello</div>;\n',
    filename: "src/example.tsx",
    parser: "oxc-ts",
    source: 'const element=<div className="greeting">Hello</div>',
  },
  {
    expected: '{ "name": "fixture", "enabled": true }\n',
    filename: "config.json",
    source: '{"name":"fixture","enabled":true}',
  },
  {
    expected: "name: fixture\nenabled: true\n",
    filename: "config.yaml",
    source: "name: fixture\nenabled: true\n",
  },
  {
    expected: '{\n  "name": "fixture",\n  "version": "1.0.0"\n}\n',
    filename: "nested/package.json",
    source: '{"version":"1.0.0","name":"fixture"}',
  },
  {
    expected:
      '[project]\nname = "fixture"\nversion = "1.0.0"\ndependencies = ["alpha", "beta"]\n',
    filename: "pyproject.toml",
    source:
      '[project]\nname="fixture"\nversion="1.0.0"\ndependencies=["alpha","beta"]\n',
  },
  {
    expected: '[project]\nname = "fixture"\n',
    filename: "minimal.toml",
    source: '[project]\nname="fixture"\n',
  },
];
await Promise.all(
  examples.map(async ({ expected, filename, parser, source }) => {
    assert.equal(await format(filename, source, parser), expected, filename);
  }),
);
process.stdout.write("ok");
