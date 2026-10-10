import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { resolveConfig } from "prettier";

import { consumerDirectory, format, verifyPluginPaths } from "./helpers.mjs";

await verifyPluginPaths();
const project = path.join(consumerDirectory, "stylesheet-project");
await fs.mkdir(project, { recursive: true });
await fs.copyFile(
  path.join(consumerDirectory, "tailwind-config.mjs"),
  path.join(project, "prettier.config.mjs"),
);
await fs.copyFile(
  path.join(consumerDirectory, "theme.css"),
  path.join(project, "theme.css"),
);

const source =
  'const element=<div className="text-brand p-widget flex card-shell"/>';
const ordinary = await format("stylesheet-control.tsx", source, "oxc-ts");
assert.ok(
  ordinary.includes('className="text-brand p-widget card-shell flex"'),
  ordinary,
);
const custom = await format("stylesheet-project/example.tsx", source, "oxc-ts");
assert.ok(
  custom.includes('className="card-shell flex p-widget text-brand"'),
  custom,
);
assert.notEqual(
  custom,
  ordinary,
  "Custom theme and utility classes must change sorting",
);
const resolved = await resolveConfig(path.join(project, "example.tsx"));
assert.ok(resolved && "tailwindStylesheet" in resolved);
assert.equal(resolved.tailwindStylesheet, "./theme.css");
process.stdout.write("ok");
