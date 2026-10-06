import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import prettier from "prettier";
import config from "@cravingmaker/prettier-config";

const directory = path.dirname(fileURLToPath(import.meta.url));
const modules = await fs.realpath(path.join(directory, "node_modules"));

// All string plugins must resolve inside this installation, never the source repository.
for (const plugin of config.plugins ?? []) {
  if (typeof plugin === "string") {
    assert.ok((await fs.realpath(plugin)).startsWith(modules + path.sep));
  }
}
for (const name of [
  "prettier-plugin-astro",
  "prettier-plugin-svelte",
  "prettier-plugin-tailwindcss",
]) {
  assert.equal(
    (config.plugins ?? []).some(
      (plugin) => typeof plugin === "string" && plugin.includes(name),
    ),
    false,
  );
}

process.chdir(path.dirname(directory));
const examples = [
  [
    "nested/config.xml",
    "<config><item name='fixture'/></config>",
    "<config><item name='fixture' /></config>\n",
  ],
  [
    "example.js",
    'const greeting="hello"',
    'const greeting = "hello";\n',
    "oxc",
  ],
  [
    "example.ts",
    'const greeting:string="hello"',
    'const greeting: string = "hello";\n',
    "oxc-ts",
  ],
  [
    "example.tsx",
    'const element=<div className="greeting">Hello</div>',
    'const element = <div className="greeting">Hello</div>;\n',
    "oxc-ts",
  ],
  [
    "config.json",
    '{"name":"fixture","enabled":true}',
    '{ "name": "fixture", "enabled": true }\n',
  ],
  [
    "config.yaml",
    "name: fixture\nenabled: true\n",
    "name: fixture\nenabled: true\n",
  ],
  [
    "nested/package.json",
    '{"version":"1.0.0","name":"fixture"}',
    '{\n  "name": "fixture",\n  "version": "1.0.0"\n}\n',
  ],
  [
    "pyproject.toml",
    '[project]\nname="fixture"\n',
    '[project]\nname = "fixture"\n',
  ],
];
for (const [filename, source, expected, parser] of examples) {
  const filepath = path.join(directory, filename);
  await fs.mkdir(path.dirname(filepath), { recursive: true });
  await fs.writeFile(filepath, source);
  const resolved = await prettier.resolveConfig(filepath);
  assert.ok(resolved, "The installed config must resolve through package.json");
  assert.equal(resolved.parser, parser, filename);
  assert.equal(resolved.singleAttributePerLine, true, filename);
  assert.equal(resolved.printWidth, undefined, filename);
  const options = { ...resolved, filepath };
  const formatted = await prettier.format(source, options);
  assert.equal(formatted, expected, filename);
  assert.equal(await prettier.format(formatted, options), formatted, filename);
}
process.stdout.write("ok");
