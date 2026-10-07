import process from "node:process";

import config from "@cravingmaker/prettier-config";

import { format } from "./helpers.mjs";

const optionalPlugins = [
  "prettier-plugin-astro",
  "prettier-plugin-svelte",
  "prettier-plugin-tailwindcss",
];

const javascript = await format("src/example.js", 'const greeting = "hello";');
const typescript = await format(
  "src/example.ts",
  'const greeting: string = "hello";',
);
const packageJson = await format(
  "nested/package.json",
  '{"version":"1.0.0","name":"fixture"}',
);
const toml = await format(
  "pyproject.toml",
  '[project]\nname="fixture"\nversion="1.0.0"\ndependencies=["alpha","beta"]\n',
);

const xml = await format(
  "nested/config.xml",
  "<config><item name='fixture'/></config>",
);
if (xml !== "<config><item name='fixture' /></config>\n") {
  throw new Error("XML formatting did not use the XML plugin");
}

const configuredPlugins = config.plugins ?? [];
const detectedOptionalPlugins = optionalPlugins.filter((plugin) =>
  configuredPlugins.some(
    (entry) => typeof entry === "string" && entry.includes(plugin),
  ),
);

if (javascript !== 'const greeting = "hello";\n') {
  throw new Error("JavaScript formatting did not use the shared config");
}

if (typescript !== 'const greeting: string = "hello";\n') {
  throw new Error("TypeScript formatting did not use the shared config");
}

if (packageJson !== '{\n  "name": "fixture",\n  "version": "1.0.0"\n}\n') {
  throw new Error(
    "package.json formatting did not use the package.json plugin",
  );
}

if (
  toml !==
  '[project]\nname = "fixture"\nversion = "1.0.0"\ndependencies = ["alpha", "beta"]\n'
) {
  throw new Error("TOML formatting did not use the TOML plugin");
}

if (detectedOptionalPlugins.length > 0) {
  throw new Error(
    "Optional plugins were detected when they were not installed",
  );
}

process.stdout.write("ok");
