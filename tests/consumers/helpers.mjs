import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import config from "@cravingmaker/prettier-config";
import { format as formatSource, resolveConfig } from "prettier";

// eslint-disable-next-line unicorn/prefer-import-meta-properties -- import.meta.dirname is not stable on the minimum Node.js 22.12 runtime.
const consumerDirectory = path.dirname(fileURLToPath(import.meta.url));

/**
 * Format a consumer file and verify that formatting is idempotent.
 * @param {string} filename
 * @param {string} source
 * @param {string} [parser]
 * @returns {Promise<string>}
 */
const format = async (filename, source, parser) => {
  const filePath = path.resolve(consumerDirectory, filename);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, source, "utf8");

  const resolved = await resolveConfig(filePath);
  if (!resolved) {
    throw new Error("Shared config was not resolved");
  }
  assert.equal(resolved.parser, parser, filename);
  assert.equal(resolved.singleAttributePerLine, true, filename);
  assert.equal(resolved.printWidth, undefined, filename);

  const options = { ...resolved, filepath: filePath };
  const formatted = await formatSource(source, options);
  if ((await formatSource(formatted, options)) !== formatted) {
    throw new Error(`Formatting is not idempotent for ${filename}`);
  }

  return formatted;
};

const verifyPluginPaths = async () => {
  const modules = await fs.realpath(
    path.join(consumerDirectory, "node_modules"),
  );
  const require = createRequire(path.join(consumerDirectory, "package.json"));
  const pluginPaths = [
    require.resolve("@prettier/plugin-oxc"),
    ...config.plugins.filter((plugin) => typeof plugin === "string"),
  ];
  await Promise.all(
    pluginPaths.map(async (plugin) => {
      const pluginPath = await fs.realpath(plugin);
      assert.ok(
        pluginPath.startsWith(modules + path.sep),
        `Plugin resolved outside the consumer installation: ${plugin}`,
      );
    }),
  );
};

export { consumerDirectory, format, verifyPluginPaths };
