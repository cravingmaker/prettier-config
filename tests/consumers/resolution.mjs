/* eslint-disable no-await-in-loop -- Each temporary broken installation must be checked and removed before another case starts. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import config from "@cravingmaker/prettier-config";

// eslint-disable-next-line unicorn/prefer-import-meta-properties -- Consumers also run on Node.js 22.12.0.
const directory = path.dirname(fileURLToPath(import.meta.url));
const runtime = import.meta.resolve("@cravingmaker/prettier-config");
const execute = promisify(execFile);
const optionalPlugins = [
  "prettier-plugin-astro",
  "prettier-plugin-svelte",
  "prettier-plugin-tailwindcss",
];
const cases = [
  { code: "MODULE_NOT_FOUND", label: "no entry point", metadata: "{}" },
  {
    code: "MODULE_NOT_FOUND",
    label: "missing main target",
    metadata: '{"main":"./missing.cjs"}',
  },
  {
    code: "MODULE_NOT_FOUND",
    label: "missing exports target",
    metadata: '{"exports":"./missing.cjs"}',
  },
  {
    code: "ERR_PACKAGE_PATH_NOT_EXPORTED",
    label: "inaccessible exports",
    metadata: '{"exports":{"./feature":"./missing.cjs"}}',
  },
  {
    code: "ERR_INVALID_PACKAGE_CONFIG",
    label: "invalid manifest",
    metadata: "{",
  },
];

// Each case uses a fresh import while resolving from the actual npm installation.
// eslint-disable-next-line functional/no-loop-statements -- Serial filesystem cases must restore each package before testing the next one.
for (const name of optionalPlugins) {
  const installed = path.join(directory, "node_modules", name);
  assert.equal(
    config.plugins.some(
      (plugin) => typeof plugin === "string" && plugin.includes(name),
    ),
    false,
    `${name}: confirmed absence is supported`,
  );
  // eslint-disable-next-line functional/no-loop-statements -- Test broken metadata independently and always restore the absent package.
  for (const { code, label, metadata } of cases) {
    await fs.mkdir(installed);
    try {
      await fs.writeFile(path.join(installed, "package.json"), metadata);
      // Node caches package metadata. A fresh process inspects each manifest,
      // using the same (possibly minimum) runtime as this consumer program.
      const result = await execute(process.execPath, [
        "--input-type=module",
        "--eval",
        `try { await import(${JSON.stringify(runtime)}); process.stdout.write('loaded'); } catch (error) { process.stdout.write(error.code); }`,
      ]);
      assert.equal(result.stdout, code, `${name}: ${label}`);
    } finally {
      await fs.rm(installed, { force: true, recursive: true });
    }
  }
}

process.stdout.write("ok");
