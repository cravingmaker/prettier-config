import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import reference from "./actionlint-reference.json" with { type: "json" };

const projectDirectory = fileURLToPath(
  new globalThis.URL("..", import.meta.url),
);
const execute = promisify(execFile);
/** @param {Uint8Array} bytes */
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** @param {string} [root] @returns {Promise<string>} */
const ensureActionlint = async (root = projectDirectory) => {
  const target = reference.releases.find(
    (release) =>
      release.platform === process.platform && release.arch === process.arch,
  );
  if (!target)
    throw new Error(
      `The pinned workflow tool has no binary for ${process.platform}/${process.arch}`,
    );
  const tools = path.join(root, ".tools");
  const cache = path.join(
    tools,
    `actionlint-${reference.version}-${process.platform}-${process.arch}`,
  );
  const binary = path.join(cache, "actionlint");
  const verify = async () => {
    if (sha256(await fs.readFile(binary)) !== target.binarySha256)
      throw new Error(
        `Cached actionlint does not match the pinned binary: ${binary}. Remove this cache directory and rerun lint:workflows.`,
      );
    return binary;
  };
  try {
    return await verify();
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
      throw error;
  }
  await fs.mkdir(tools, { recursive: true });
  const staging = await fs.mkdtemp(path.join(tools, ".actionlint-"));
  try {
    const url = `https://github.com/rhysd/actionlint/releases/download/v${reference.version}/${target.archive}`;
    const response = await globalThis.fetch(url, {
      signal: globalThis.AbortSignal.timeout(30_000),
    });
    if (!response.ok)
      throw new Error(
        `Download pinned actionlint: HTTP ${String(response.status)} from ${url}`,
      );
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (sha256(bytes) !== target.archiveSha256)
      throw new Error(
        `Pinned actionlint archive checksum mismatch: ${target.archive}`,
      );
    const archive = path.join(staging, target.archive);
    await fs.writeFile(archive, bytes);
    await execute("tar", ["-xzf", archive, "-C", staging, "actionlint"], {
      maxBuffer: 1024 * 1024,
      timeout: 30_000,
    });
    const extracted = path.join(staging, "actionlint");
    if (sha256(await fs.readFile(extracted)) !== target.binarySha256)
      throw new Error(
        `Pinned actionlint binary checksum mismatch: ${target.archive}`,
      );
    await fs.mkdir(cache, { recursive: true });
    try {
      await fs.copyFile(extracted, binary, constants.COPYFILE_EXCL);
    } catch (error) {
      if (!(
        error instanceof Error &&
        "code" in error &&
        error.code === "EEXIST"
      ))
        throw error;
    }
    return await verify();
  } finally {
    await fs.rm(staging, { force: true, recursive: true });
  }
};

export { ensureActionlint, projectDirectory };
