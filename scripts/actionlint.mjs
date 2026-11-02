import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import reference from "./actionlint-reference.json" with { type: "json" };

/**
 * @typedef {(typeof reference.releases)[number]} Release
 */

const projectDirectory = fileURLToPath(new globalThis.URL("..", import.meta.url));
const execute = promisify(execFile);
const timeout = 30_000;

/**
 * @param {unknown} error
 * @param {string} code
 */
const hasCode = (error, code) => {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
};

/**
 * Throws `message` unless the SHA-256 digest of `bytes` is `expected`.
 *
 * @param {Uint8Array} bytes
 * @param {string} expected
 * @param {string} message
 */
const verifyChecksum = (bytes, expected, message) => {
  if (createHash("sha256").update(bytes).digest("hex") !== expected) {
    throw new Error(message);
  }
};

/**
 * Whether the cache holds the pinned binary. Other content fails instead of being replaced, because the cache may hold user files.
 *
 * @param {string} binary
 * @param {Release} release
 * @returns {Promise<boolean>}
 */
const isCached = async (binary, release) => {
  try {
    const bytes = await fs.readFile(binary);
    verifyChecksum(
      bytes,
      release.binarySha256,
      `Cached actionlint does not match the pinned binary: ${binary}. Remove this cache directory and rerun lint:workflows.`,
    );
    return true;
  } catch (error) {
    if (hasCode(error, "ENOENT")) {
      return false;
    }
    throw error;
  }
};

/**
 * Downloads the pinned archive and extracts its binary into `directory`, verifying both.
 *
 * @param {string} directory
 * @param {Release} release
 * @returns {Promise<string>}
 */
const download = async (directory, release) => {
  const url = `https://github.com/rhysd/actionlint/releases/download/v${reference.version}/${release.archive}`;
  const response = await globalThis.fetch(url, { signal: globalThis.AbortSignal.timeout(timeout) });
  if (!response.ok) {
    throw new Error(`Download pinned actionlint: HTTP ${String(response.status)} from ${url}`);
  }
  const archive = new Uint8Array(await response.arrayBuffer());
  verifyChecksum(archive, release.archiveSha256, `Pinned actionlint archive checksum mismatch: ${release.archive}`);
  // Extract the verified archive from standard input, so downloaded data is never written to a file.
  const extraction = execute("tar", ["-xzf", "-", "-C", directory, "actionlint"], { maxBuffer: 1024 * 1024, timeout });
  extraction.child.stdin?.end(archive);
  await extraction;
  const extracted = path.join(directory, "actionlint");
  verifyChecksum(await fs.readFile(extracted), release.binarySha256, `Pinned actionlint binary checksum mismatch: ${release.archive}`);
  return extracted;
};

/**
 * @param {string} source
 * @param {string} target
 */
const copyOnce = async (source, target) => {
  try {
    await fs.copyFile(source, target, constants.COPYFILE_EXCL);
  } catch (error) {
    // A concurrent run installed the binary first; the caller verifies it.
    if (!hasCode(error, "EEXIST")) {
      throw error;
    }
  }
};

/**
 * Installs the pinned binary at `binary` through a staging directory in `tools`.
 *
 * @param {string} tools
 * @param {string} binary
 * @param {Release} release
 */
const install = async (tools, binary, release) => {
  await fs.mkdir(tools, { recursive: true });
  const staging = await fs.mkdtemp(path.join(tools, ".actionlint-"));
  try {
    const extracted = await download(staging, release);
    await fs.mkdir(path.dirname(binary), { recursive: true });
    await copyOnce(extracted, binary);
  } finally {
    await fs.rm(staging, { force: true, recursive: true });
  }
};

/**
 * Returns the pinned actionlint binary, downloading and verifying it on first use.
 *
 * @param {string} [root]
 * @returns {Promise<string>}
 */
const ensureActionlint = async (root = projectDirectory) => {
  const release = reference.releases.find((candidate) => {
    return candidate.platform === process.platform && candidate.arch === process.arch;
  });
  if (!release) {
    throw new Error(`The pinned workflow tool has no binary for ${process.platform}/${process.arch}`);
  }
  const tools = path.join(root, ".tools");
  const binary = path.join(tools, `actionlint-${reference.version}-${process.platform}-${process.arch}`, "actionlint");
  if (await isCached(binary, release)) {
    return binary;
  }
  await install(tools, binary, release);
  if (!(await isCached(binary, release))) {
    throw new Error(`Installed actionlint is missing: ${binary}`);
  }
  return binary;
};

export { ensureActionlint, projectDirectory };
