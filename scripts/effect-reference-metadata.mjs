import fs from "node:fs/promises";
import path from "node:path";

import { Schema } from "effect";

import { decodeJson, decodeValue } from "./manifest.mjs";

const effectPackages = [
  { manifest: "packages/effect/package.json", name: "effect" },
  {
    manifest: "packages/platform/node-shared/package.json",
    name: "@effect/platform-node-shared",
  },
  { manifest: "packages/vitest/package.json", name: "@effect/vitest" },
];
const referenceSchema = Schema.Struct({
  commit: Schema.String.check(Schema.isPattern(/^[\da-f]{40}$/)),
  repository: Schema.String.check(Schema.isPattern(/\S/)),
  tag: Schema.String,
  version: Schema.String.check(
    Schema.isPattern(/^(?:\d+\.\d+\.\d+|\d+\.\d+\.\d+-[\d\-.a-z]+)$/i),
  ),
});
const dependenciesSchema = Schema.Struct({
  devDependencies: Schema.Record(Schema.String, Schema.String),
});
const lockSchema = Schema.Struct({
  lockfileVersion: Schema.Number,
  packages: Schema.Record(Schema.String, Schema.Unknown),
});
const installedSchema = Schema.Struct({ version: Schema.String });

/** @param {string} projectDirectory */
const checkEffectReference = async (projectDirectory) => {
  const referencePath = path.join(
    projectDirectory,
    "scripts/effect-reference.json",
  );
  const manifestPath = path.join(projectDirectory, "package.json");
  const lockPath = path.join(projectDirectory, "package-lock.json");
  const [referenceContents, manifestContents, lockContents] = await Promise.all(
    [
      fs.readFile(referencePath, "utf8"),
      fs.readFile(manifestPath, "utf8"),
      fs.readFile(lockPath, "utf8"),
    ],
  );
  const reference = decodeJson(
    referenceSchema,
    referenceContents,
    referencePath,
    "validate reference metadata",
  );
  const manifest = decodeJson(
    dependenciesSchema,
    manifestContents,
    manifestPath,
    "validate declared dependencies",
  );
  const lock = decodeJson(
    lockSchema,
    lockContents,
    lockPath,
    "validate lockfile",
  );
  const installedPackages = new Map(Object.entries(lock.packages));
  const root = decodeValue(
    dependenciesSchema,
    installedPackages.get(""),
    lockPath,
    "validate root lockfile",
  );
  if (reference.tag !== `effect@${reference.version}`)
    throw new Error(
      `${referencePath}: tag must equal effect@${reference.version}`,
    );
  if (lock.lockfileVersion !== 3)
    throw new Error(
      `${lockPath}: expected the repository's version 3 npm lockfile`,
    );
  const declared = new Map(Object.entries(manifest.devDependencies));
  const locked = new Map(Object.entries(root.devDependencies));
  // eslint-disable-next-line functional/no-loop-statements -- Validate each coordinated pin with its own actionable diagnostic.
  for (const { name } of effectPackages) {
    if (declared.get(name) !== reference.version)
      throw new Error(
        `${manifestPath}: update the source pin to match the exact ${name} dependency (${reference.version})`,
      );
    if (locked.get(name) !== reference.version)
      throw new Error(
        `${lockPath}: root lockfile ${name} pin differs from ${reference.version}`,
      );
    const key = `node_modules/${name}`;
    const installed = decodeValue(
      installedSchema,
      installedPackages.get(key),
      lockPath,
      `validate ${key}`,
    );
    if (installed.version !== reference.version)
      throw new Error(
        `${lockPath}: ${key} version differs from ${reference.version}`,
      );
  }
  return reference;
};

export { checkEffectReference, effectPackages };
