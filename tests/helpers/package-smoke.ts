import type { PlatformError } from "effect/PlatformError";

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
  Stream,
} from "effect";
import {
  NodeChildProcessSpawner,
  NodeFileSystem,
  NodePath,
} from "@effect/platform-node-shared";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

import packageJson from "../../package.json" with { type: "json" };

const projectDirectory = fileURLToPath(new URL("../..", import.meta.url));
const consumerNode =
  // eslint-disable-next-line n/no-process-env -- CI chooses the consumer runtime separately from the development runtime
  process.env.PRETTIER_CONFIG_CONSUMER_NODE ?? process.execPath;

const commandFields = {
  args: Schema.Array(Schema.String),
  cwd: Schema.String,
  executable: Schema.String,
  message: Schema.String,
  phase: Schema.String,
};

type CommandSpec = {
  readonly args: readonly string[];
  readonly cwd: string;
  readonly executable: string;
  readonly phase: string;
  readonly timeoutMs: number;
};
type SmokeError =
  | CommandDeadline
  | CommandFailure
  | CommandOutputLimit
  | InvalidTarballCount
  | SmokeFileSystemError;

class CommandDeadline extends Schema.TaggedError<CommandDeadline>()(
  "CommandDeadline",
  {
    ...commandFields,
    timeoutMs: Schema.Number,
  },
) {}
class CommandFailure extends Schema.TaggedError<CommandFailure>()(
  "CommandFailure",
  {
    ...commandFields,
    cause: Schema.Defect(),
    exitCode: Schema.optional(Schema.Number),
    stderr: Schema.optional(Schema.String),
    stdout: Schema.optional(Schema.String),
  },
) {}
class CommandOutputLimit extends Schema.TaggedError<CommandOutputLimit>()(
  "CommandOutputLimit",
  {
    ...commandFields,
    limit: Schema.Number,
    stream: Schema.Literals(["stdout", "stderr"]),
  },
) {}
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

const outputLimit = 1024 * 1024;
const platformServices = Layer.merge(NodeFileSystem.layer, NodePath.layer);
const nodeServices = NodeChildProcessSpawner.layer.pipe(
  Layer.provideMerge(platformServices),
);

const runCommand = Effect.fn("packageSmoke.runCommand")(function* (
  spec: CommandSpec,
) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const details = {
    args: [...spec.args],
    cwd: spec.cwd,
    executable: spec.executable,
    phase: spec.phase,
  };
  const failure = (cause: unknown) =>
    new CommandFailure({
      ...details,
      cause,
      message: `${spec.phase}: ${spec.executable} failed in ${spec.cwd}`,
    });
  const collect = (
    stream: Stream.Stream<Uint8Array, PlatformError>,
    name: "stderr" | "stdout",
  ) =>
    stream.pipe(
      Stream.runFoldEffect(
        (): {
          readonly chunks: readonly Uint8Array[];
          readonly size: number;
        } => ({ chunks: [], size: 0 }),
        (buffer, chunk) =>
          buffer.size + chunk.byteLength > outputLimit
            ? Effect.fail(
                new CommandOutputLimit({
                  ...details,
                  limit: outputLimit,
                  message: `${spec.phase}: ${name} exceeds ${String(outputLimit)} bytes`,
                  stream: name,
                }),
              )
            : Effect.succeed({
                chunks: [...buffer.chunks, chunk],
                size: buffer.size + chunk.byteLength,
              }),
      ),
      Effect.map((buffer) => Buffer.concat(buffer.chunks).toString("utf8")),
      Effect.catchTag("PlatformError", (cause) => Effect.fail(failure(cause))),
    );

  return yield* Effect.gen(function* () {
    const handle = yield* spawner
      .spawn(
        ChildProcess.make(spec.executable, [...spec.args], {
          cwd: spec.cwd,
          extendEnv: true,
          forceKillAfter: "1 second",
        }),
      )
      .pipe(Effect.mapError(failure));
    const [stdout, stderr, exitCode] = yield* Effect.all(
      [
        collect(handle.stdout, "stdout"),
        collect(handle.stderr, "stderr"),
        handle.exitCode.pipe(Effect.mapError(failure)),
      ],
      { concurrency: "unbounded" },
    );
    if (exitCode !== 0) {
      return yield* new CommandFailure({
        ...details,
        cause: new Error(`Exit code ${String(exitCode)}`),
        exitCode,
        message: `${spec.phase}: ${spec.executable} exited with ${String(
          exitCode,
        )} in ${spec.cwd}\nstdout:\n${stdout}\nstderr:\n${stderr}`,
        stderr,
        stdout,
      });
    }
    return stdout;
  }).pipe(
    Effect.scoped,
    Effect.timeoutOrElse({
      duration: spec.timeoutMs,
      orElse: () =>
        Effect.fail(
          new CommandDeadline({
            ...details,
            message: `${spec.phase}: ${spec.executable} exceeded ${String(spec.timeoutMs)}ms in ${spec.cwd}`,
            timeoutMs: spec.timeoutMs,
          }),
        ),
    }),
  );
});

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
  readonly createConsumer: (
    name: string,
    dependencies: readonly string[],
  ) => Effect.Effect<string, SmokeError>;
  readonly installConsumer: (
    name: string,
    dependencies: readonly string[],
  ) => Effect.Effect<string, SmokeError>;
  readonly isInstalledPackageSymlink: (
    consumer: string,
  ) => Effect.Effect<boolean, SmokeFileSystemError>;
  readonly run: (
    spec: CommandSpec,
  ) => Effect.Effect<
    string,
    CommandDeadline | CommandFailure | CommandOutputLimit
  >;
  readonly runConsumer: (
    consumer: string,
    script: "base.mjs" | "optional.mjs",
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
  ) => Effect.Effect<
    void,
    SmokeError,
    ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem
  >,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const scope = yield* Scope.fork(yield* Effect.scope);
  const run = (spec: CommandSpec) =>
    runCommand(spec).pipe(
      Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
    );

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
    const createConsumer = Effect.fn("packageSmoke.createConsumer")(function* (
      name: string,
      dependencies: readonly string[],
    ) {
      const consumer = path.join(workspace, name);
      const modules = path.join(consumer, "node_modules");
      const installed = path.join(modules, packageJson.name);
      yield* withFileContext(
        "create consumer",
        installed,
        fs.makeDirectory(installed, { recursive: true }),
      );
      yield* run({
        args: ["-xzf", tarball, "--strip-components=1", "-C", installed],
        cwd: workspace,
        executable: "tar",
        phase: "extract tarball",
        timeoutMs: 30_000,
      });
      yield* Effect.forEach(
        dependencies,
        Effect.fnUntraced(function* (dependency) {
          const destination = path.join(modules, dependency);
          yield* withFileContext(
            "create dependency parent",
            destination,
            fs.makeDirectory(path.dirname(destination), { recursive: true }),
          );
          yield* withFileContext(
            "link dependency",
            destination,
            Effect.tryPromise({
              catch: (cause) =>
                new SmokeFileSystemError({
                  cause,
                  message: `Could not link dependency at ${destination}`,
                  path: destination,
                  phase: "link dependency",
                }),
              async try() {
                await nativeFs.symlink(
                  path.join(projectDirectory, "node_modules", dependency),
                  destination,
                  "junction",
                );
              },
            }),
          );
        }),
        { concurrency: "unbounded", discard: true },
      );
      yield* manifest(consumer, `prettier-config-${name}`);
      return consumer;
    });
    const installConsumer = Effect.fn("packageSmoke.installConsumer")(
      function* (name: string, dependencies: readonly string[]) {
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
            `prettier@${packageJson.devDependencies.prettier}`,
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
      script: "base.mjs" | "optional.mjs",
      externalCwd: boolean,
    ) {
      yield* copyFixtures(
        consumer,
        ["tests", "consumers"],
        [script, "helpers.mjs"],
      );
      return yield* run({
        args: [path.join(consumer, script)],
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
      createConsumer,
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
  CommandDeadline,
  CommandFailure,
  CommandOutputLimit,
  consumerNode,
  createPackageSmoke,
  InvalidTarballCount,
  nodeServices,
  PackageSmoke,
  packageSmokeLayer,
  projectDirectory,
  runCommand,
  SmokeFileSystemError,
};
export type { CommandSpec, SmokeError };
