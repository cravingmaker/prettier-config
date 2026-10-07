import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { format as formatSource, resolveConfig } from "prettier";

// eslint-disable-next-line unicorn/prefer-import-meta-properties -- import.meta.dirname is not stable on the minimum Node.js 22.12 runtime.
const consumerDirectory = path.dirname(fileURLToPath(import.meta.url));

/**
 * Format a consumer file and verify that formatting is idempotent.
 * @param {string} filename
 * @param {string} source
 * @returns {Promise<string>}
 */
const format = async (filename, source) => {
  const filePath = path.resolve(consumerDirectory, filename);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, source, "utf8");

  const resolved = await resolveConfig(filePath);
  if (!resolved) {
    throw new Error("Shared config was not resolved");
  }

  const options = { ...resolved, filepath: filePath };
  const formatted = await formatSource(source, options);
  if ((await formatSource(formatted, options)) !== formatted) {
    throw new Error(`Formatting is not idempotent for ${filename}`);
  }

  return formatted;
};

export { consumerDirectory, format };
