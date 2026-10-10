import type { CommandError, CommandSpec } from "./node-command.js";

import nativeFs from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  Context,
  Effect,
  Exit,
  FileSystem,
  Layer,
  Path,
  Schema,
  Scope,
} from "effect";
import { layer as nodeFileSystemLayer } from "@effect/platform-node-shared/NodeFileSystem";
import { layer as nodePathLayer } from "@effect/platform-node-shared/NodePath";

import { runCommand } from "./node-command.js";
import packageJson from "../../package.json" with { type: "json" };
import { peerScenario } from "./peer-scenarios.js";

const projectDirectory = fileURLToPath(new URL("../..", import.meta.url));
const consumerNode =
  // eslint-disable-next-line n/no-process-env -- CI chooses the consumer runtime separately from the development runtime
  process.env.PRETTIER_CONFIG_CONSUMER_NODE ?? process.execPath;

type SmokeError = CommandError | InvalidTarballCount | SmokeFileSystemError;

class InvalidTarballCount extends Schema.TaggedError<InvalidTarballCount>()(
  "InvalidTarballCount",
  {
    count: Schema.Number,
    message: Schema.String,
    workspace: Schema.String,
  },
) {}
class SmokeFileSystemError extends Schema.TaggedError<SmokeFileSystemError>()(
  "SmokeFileSystemError",
  {
    cause: Schema.Defect(),
    message: Schema.String,
    path: Schema.String,
    phase: Schema.String,
  },
) {}

const nodeServices = Layer.merge(nodeFileSystemLayer, nodePathLayer);

const withFileContext = <A, E>(
  phase: string,
  filename: string,
  operation: Effect.Effect<A, E>,
) =>
  operation.pipe(
    Effect.mapError(
      (cause) =>
        new SmokeFileSystemError({
          cause,
          message: `${phase}: filesystem operation failed at ${filename}`,
          path: filename,
          phase,
        }),
    ),
  );

type SmokeHarness = {
  readonly copyFixtures: (
    consumer: string,
    source: readonly string[],
    filenames: readonly string[],
  ) => Effect.Effect<void, SmokeFileSystemError>;
  readonly installConsumer: (
    name: string,
    dependencies: readonly string[],
    prettierVersion?: string,
  ) => Effect.Effect<string, SmokeError>;
  readonly isInstalledPackageSymlink: (
    consumer: string,
  ) => Effect.Effect<boolean, SmokeFileSystemError>;
  readonly run: (spec: CommandSpec) => Effect.Effect<string, CommandError>;
  readonly runConsumer: (
    consumer: string,
    script: "installed.mjs" | "optional.mjs" | "tailwind.mjs",
    externalCwd: boolean,
  ) => Effect.Effect<string, SmokeError>;
  readonly tarball: string;
  readonly workspace: string;
};

class PackageSmoke extends Context.Service<PackageSmoke, SmokeHarness>()(
  "prettier-config/tests/PackageSmoke",
) {}

const createPackageSmoke = Effect.fn("packageSmoke.acquire")(function* (
  pack?: (
    workspace: string,
  ) => Effect.Effect<void, SmokeError, FileSystem.FileSystem>,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const scope = yield* Scope.fork(yield* Effect.scope);
  const run = runCommand;

  return yield* Effect.gen(function* () {
    const workspace = yield* Effect.acquireRelease(
      withFileContext(
        "allocate workspace",
        "temporary directory",
        fs.makeTempDirectory({ prefix: "prettier-config-package-" }),
      ),
      (directory) =>
        withFileContext(
          "remove workspace",
          directory,
          fs.remove(directory, { force: true, recursive: true }),
        ).pipe(Effect.orDie),
    );
    yield* pack
      ? pack(workspace)
      : run({
          args: ["pack", "--ignore-scripts", "--pack-destination", workspace],
          cwd: projectDirectory,
          executable: "npm",
          phase: "pack",
          timeoutMs: 30_000,
        });
    const files = yield* withFileContext(
      "find tarball",
      workspace,
      fs.readDirectory(workspace),
    );
    const tarballs = files.filter((filename) => filename.endsWith(".tgz"));
    const [filename] = tarballs;
    if (tarballs.length !== 1 || filename === undefined) {
      return yield* new InvalidTarballCount({
        count: tarballs.length,
        message: `Expected exactly one packed tarball, found ${String(tarballs.length)} in ${workspace}`,
        workspace,
      });
    }
    const tarball = path.join(workspace, filename);
    const manifest = (consumer: string, name = path.basename(consumer)) =>
      withFileContext(
        "write consumer manifest",
        consumer,
        fs.writeFileString(
          path.join(consumer, "package.json"),
          JSON.stringify({
            name,
            prettier: packageJson.name,
            private: true,
            type: "module",
          }),
        ),
      );
    const copyFixtures = Effect.fn("packageSmoke.copyFixtures")(function* (
      consumer: string,
      source: readonly string[],
      filenames: readonly string[],
    ) {
      yield* Effect.forEach(
        filenames,
        (file) =>
          withFileContext(
            "copy fixture",
            path.join(consumer, file),
            fs.copyFile(
              path.join(projectDirectory, ...source, file),
              path.join(consumer, file),
            ),
          ),
        { concurrency: "unbounded", discard: true },
      );
    });
    const installConsumer = Effect.fn("packageSmoke.installConsumer")(
      function* (
        name: string,
        dependencies: readonly string[],
        prettierVersion: string = peerScenario.prettier,
      ) {
        const consumer = path.join(workspace, name);
        yield* withFileContext(
          "create installed consumer",
          consumer,
          fs.makeDirectory(consumer),
        );
        yield* manifest(consumer);
        yield* run({
          args: [
            "install",
            "--ignore-scripts",
            "--no-audit",
            "--no-fund",
            "--save-exact",
            tarball,
            `prettier@${prettierVersion}`,
            ...dependencies,
          ],
          cwd: consumer,
          executable: "npm",
          phase: "install consumer",
          timeoutMs: 120_000,
        });
        return consumer;
      },
    );
    const runConsumer = Effect.fn("packageSmoke.runConsumer")(function* (
      consumer: string,
      script: "installed.mjs" | "optional.mjs" | "tailwind.mjs",
      externalCwd: boolean,
    ) {
      yield* copyFixtures(
        consumer,
        ["tests", "consumers"],
        [script, "helpers.mjs"],
      );
      return yield* run({
        args: [path.join(consumer, script), peerScenario.prettier],
        cwd: externalCwd ? path.dirname(consumer) : consumer,
        executable: consumerNode,
        phase: `run ${script}`,
        timeoutMs: 30_000,
      });
    });
    const isInstalledPackageSymlink = (consumer: string) =>
      withFileContext(
        "inspect installed package",
        consumer,
        Effect.tryPromise({
          catch: (cause) =>
            new SmokeFileSystemError({
              cause,
              message: `Could not inspect installed package at ${consumer}`,
              path: consumer,
              phase: "inspect installed package",
            }),
          try: async () =>
            await nativeFs.lstat(
              path.join(consumer, "node_modules", packageJson.name),
            ),
        }).pipe(Effect.map((stat) => stat.isSymbolicLink())),
      );
    return PackageSmoke.of({
      copyFixtures,
      installConsumer,
      isInstalledPackageSymlink,
      run,
      runConsumer,
      tarball,
      workspace,
    });
  }).pipe(
    Scope.provide(scope),
    Effect.onExit((exit) =>
      Exit.isFailure(exit) ? Scope.close(scope, exit) : Effect.void,
    ),
  );
});

const packageSmokeLayer = Layer.effect(PackageSmoke, createPackageSmoke()).pipe(
  Layer.provideMerge(nodeServices),
);

export {
  consumerNode,
  createPackageSmoke,
  InvalidTarballCount,
  nodeServices,
  PackageSmoke,
  packageSmokeLayer,
  projectDirectory,
  SmokeFileSystemError,
};
export type { SmokeError };
export {
  type CommandSpec,
  CommandDeadline,
  CommandFailure,
  CommandOutputLimit,
  runCommand,
} from "./node-command.js";
