import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  checkEffectReference,
  effectPackages as packages,
} from "./effect-reference-metadata.mjs";
import { foreignGitEnvironment } from "./git-environment.mjs";
import { decodeJson, packageManifestSchema } from "./manifest.mjs";

const projectDirectory = fileURLToPath(
  new globalThis.URL("..", import.meta.url),
);
const referencesDirectory = path.join(projectDirectory, "repos");
const destination = path.join(referencesDirectory, "effect");
const execute = promisify(execFile);

/** @param {string} filename */
const inspect = async (filename) => {
  try {
    return await fs.lstat(filename);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
};

/** @param {readonly string[]} arguments_ @param {string} directory */
const git = async (arguments_, directory) =>
  execute("git", arguments_, {
    cwd: directory,
    encoding: "utf8",
    env: await foreignGitEnvironment(),
    maxBuffer: 1024 * 1024,
    timeout: 60_000,
  });

/** @param {string} directory @param {Awaited<ReturnType<typeof checkEffectReference>>} reference */
const verify = async (directory, reference) => {
  const gitDirectory = await inspect(path.join(directory, ".git"));
  if (!gitDirectory?.isDirectory() || gitDirectory.isSymbolicLink()) {
    throw new Error(`Expected a standalone Git checkout at ${directory}`);
  }
  const revision = await git(["rev-parse", "HEAD"], directory);
  if (revision.stdout.trim() !== reference.commit) {
    throw new Error(`Reference commit differs from ${reference.commit}`);
  }
  const origin = await git(["remote", "get-url", "origin"], directory);
  if (origin.stdout.trim() !== reference.repository) {
    throw new Error("Reference origin differs from the pinned repository");
  }
  const status = await git(
    ["status", "--porcelain", "--untracked-files=all"],
    directory,
  );
  if (status.stdout.trim() !== "") {
    throw new Error(
      "Reference checkout has local changes; preserve them before updating",
    );
  }
  await Promise.all(
    packages.map(async (package_) => {
      const filename = path.join(directory, package_.manifest);
      const manifest = decodeJson(
        packageManifestSchema,
        await fs.readFile(filename, "utf8"),
        filename,
        "verify reference package",
      );
      if (
        manifest.name !== package_.name ||
        manifest.version !== reference.version
      ) {
        throw new Error(
          `Reference package ${package_.name} differs from ${reference.version}`,
        );
      }
    }),
  );
};

const setup = async () => {
  const reference = await checkEffectReference(projectDirectory);
  const parent = await inspect(referencesDirectory);
  if (parent && (!parent.isDirectory() || parent.isSymbolicLink())) {
    throw new Error(`Expected a real directory at ${referencesDirectory}`);
  }
  await fs.mkdir(referencesDirectory, { recursive: true });
  const existing = await inspect(destination);
  if (existing) {
    if (!existing.isDirectory() || existing.isSymbolicLink()) {
      throw new Error(
        `Unexpected content at ${destination}; leave it intact and move it aside`,
      );
    }
    await verify(destination, reference);
    process.stdout.write(
      `Effect ${reference.version} reference verified at ${destination}\n`,
    );
    return;
  }

  const staging = await fs.mkdtemp(path.join(referencesDirectory, ".effect-"));
  try {
    await git(
      [
        "clone",
        "--depth",
        "1",
        "--single-branch",
        "--branch",
        reference.tag,
        reference.repository,
        staging,
      ],
      projectDirectory,
    );
    await verify(staging, reference);
    if (await inspect(destination)) {
      throw new Error(
        `Content appeared at ${destination}; leave it intact and retry`,
      );
    }
    await fs.rename(staging, destination);
    process.stdout.write(
      `Effect ${reference.version} reference ready at ${destination}\n`,
    );
  } finally {
    await fs.rm(staging, { force: true, recursive: true });
  }
};

try {
  await setup();
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
