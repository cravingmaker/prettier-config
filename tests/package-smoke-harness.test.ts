import { Effect, Fiber, FileSystem, Ref, Schedule, Schema } from "effect";
import { it } from "@effect/vitest";
import { expect } from "vitest";

import {
  createPackageSmoke,
  nodeServices,
  runCommand,
  SmokeFileSystemError,
} from "./helpers/package-smoke.js";

const writeArchive = Effect.fnUntraced(function* (
  workspace: string,
  filename: string,
) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(`${workspace}/${filename}`, "test archive").pipe(
    Effect.mapError(
      (cause) =>
        new SmokeFileSystemError({
          cause,
          message: "Test archive could not be written",
          path: workspace,
          phase: "test pack",
        }),
    ),
  );
});
const fakePack = (workspace: string) => writeArchive(workspace, "package.tgz");

const waitForPid = Effect.fnUntraced(function* (filename: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.exists(filename).pipe(
    Effect.repeat({
      schedule: Schedule.spaced("10 millis"),
      until: (exists) => exists,
    }),
    Effect.timeout("5 seconds"),
  );
  return yield* Schema.decodeUnknownEffect(Schema.NumberFromString)(
    yield* fs.readFileString(filename),
  );
});

const uncooperativeChild = [
  "process.on('SIGTERM', () => {});",
  "require('node:fs').writeFileSync(process.argv[1], String(process.pid));",
  "setInterval(() => {}, 1000);",
].join("\n");

it.live(
  "removes the workspace before propagating a packing failure",
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const workspaceRef = yield* Ref.make("");
      const error = yield* createPackageSmoke(
        Effect.fnUntraced(function* (workspace) {
          yield* Ref.set(workspaceRef, workspace);
          yield* runCommand({
            args: [
              "-e",
              "process.stderr.write('packing failed'); process.exit(7);",
            ],
            cwd: workspace,
            executable: process.execPath,
            phase: "pack",
            timeoutMs: 5000,
          });
        }),
      ).pipe(Effect.flip);
      const workspace = yield* Ref.get(workspaceRef);
      expect(workspace).not.toBe("");
      expect(error).toMatchObject({
        cwd: workspace,
        exitCode: 7,
        phase: "pack",
        stderr: "packing failed",
        _tag: "CommandFailure",
      });
      expect(yield* fs.exists(workspace)).toBe(false);
    }).pipe(Effect.scoped, Effect.provide(nodeServices)),
  10_000,
);

it.live.each([0, 2])(
  "removes the workspace when packing produces %s tarballs",
  (count) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const workspaceRef = yield* Ref.make("");
      const error = yield* createPackageSmoke(
        Effect.fnUntraced(function* (workspace) {
          yield* Ref.set(workspaceRef, workspace);
          yield* Effect.forEach(
            Array.from({ length: count }, (_, index) => index),
            (index) => writeArchive(workspace, `${String(index)}.tgz`),
            { discard: true },
          );
        }),
      ).pipe(Effect.flip);
      const workspace = yield* Ref.get(workspaceRef);
      expect(error).toMatchObject({
        count,
        _tag: "InvalidTarballCount",
        workspace,
      });
      expect(yield* fs.exists(workspace)).toBe(false);
    }).pipe(Effect.scoped, Effect.provide(nodeServices)),
);

it.live("retains command arguments, exit status, and both output streams", () =>
  Effect.gen(function* () {
    const smoke = yield* createPackageSmoke(fakePack);
    const arguments_ = [
      "-e",
      "process.stdout.write('output'); process.stderr.write('diagnostic'); process.exit(9);",
    ];
    const error = yield* smoke
      .run({
        args: arguments_,
        cwd: smoke.workspace,
        executable: process.execPath,
        phase: "local failure",
        timeoutMs: 5000,
      })
      .pipe(Effect.flip);
    expect(error).toMatchObject({
      args: arguments_,
      cwd: smoke.workspace,
      executable: process.execPath,
      exitCode: 9,
      phase: "local failure",
      stderr: "diagnostic",
      stdout: "output",
      _tag: "CommandFailure",
    });
    expect(error.message).toContain("diagnostic");
  }).pipe(Effect.scoped, Effect.provide(nodeServices)),
);

it.live(
  "keeps the shared workspace across commands and removes it on disposal",
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const workspace = yield* Effect.scoped(
        Effect.gen(function* () {
          const smoke = yield* createPackageSmoke(fakePack);
          expect(yield* fs.exists(smoke.tarball)).toBe(true);
          const spec = {
            args: ["-e", "process.stdout.write(process.cwd());"],
            cwd: smoke.workspace,
            executable: process.execPath,
            phase: "local success",
            timeoutMs: 5000,
          };
          expect(yield* smoke.run(spec)).toBe(
            yield* fs.realPath(smoke.workspace),
          );
          expect(yield* smoke.run(spec)).toBe(
            yield* fs.realPath(smoke.workspace),
          );
          expect(yield* fs.exists(smoke.workspace)).toBe(true);
          return smoke.workspace;
        }),
      );
      expect(yield* fs.exists(workspace)).toBe(false);
    }).pipe(Effect.provide(nodeServices)),
  10_000,
);

it.live(
  "waits for forced termination before returning a deadline failure",
  () =>
    Effect.gen(function* () {
      const smoke = yield* createPackageSmoke(fakePack);
      const ready = `${smoke.workspace}/ready`;
      const fiber = yield* smoke
        .run({
          args: ["-e", uncooperativeChild, ready],
          cwd: smoke.workspace,
          executable: process.execPath,
          phase: "deadline",
          timeoutMs: 2000,
        })
        .pipe(Effect.flip, Effect.forkChild);
      const pid = yield* waitForPid(ready);
      const error = yield* Fiber.join(fiber);
      expect(error).toMatchObject({
        cwd: smoke.workspace,
        phase: "deadline",
        _tag: "CommandDeadline",
        timeoutMs: 2000,
      });
      expect(() => process.kill(pid, 0)).toThrow(
        expect.objectContaining({ code: "ESRCH" }),
      );
    }).pipe(Effect.scoped, Effect.provide(nodeServices)),
  10_000,
);

it.live(
  "releases an interrupted process before disposing the suite workspace",
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const workspace = yield* Effect.scoped(
        Effect.gen(function* () {
          const smoke = yield* createPackageSmoke(fakePack);
          const ready = `${smoke.workspace}/ready`;
          const fiber = yield* smoke
            .run({
              args: ["-e", uncooperativeChild, ready],
              cwd: smoke.workspace,
              executable: process.execPath,
              phase: "interrupted command",
              timeoutMs: 30_000,
            })
            .pipe(Effect.forkChild);
          const pid = yield* waitForPid(ready);
          yield* Fiber.interrupt(fiber);
          expect(() => process.kill(pid, 0)).toThrow(
            expect.objectContaining({ code: "ESRCH" }),
          );
          expect(yield* fs.exists(smoke.workspace)).toBe(true);
          return smoke.workspace;
        }),
      );
      expect(yield* fs.exists(workspace)).toBe(false);
    }).pipe(Effect.provide(nodeServices)),
  10_000,
);

it.live.each(["stderr", "stdout"] as const)(
  "limits %s output and terminates the child",
  (stream) =>
    Effect.gen(function* () {
      const smoke = yield* createPackageSmoke(fakePack);
      const ready = `${smoke.workspace}/ready`;
      const code = `${uncooperativeChild}\nprocess.${stream}.write(Buffer.alloc(1024 * 1024 + 1));`;
      const fiber = yield* smoke
        .run({
          args: ["-e", code, ready],
          cwd: smoke.workspace,
          executable: process.execPath,
          phase: "output limit",
          timeoutMs: 5000,
        })
        .pipe(Effect.flip, Effect.forkChild);
      const pid = yield* waitForPid(ready);
      const error = yield* Fiber.join(fiber);
      expect(error).toMatchObject({
        limit: 1024 * 1024,
        stream,
        _tag: "CommandOutputLimit",
      });
      expect(() => process.kill(pid, 0)).toThrow(
        expect.objectContaining({ code: "ESRCH" }),
      );
    }).pipe(Effect.scoped, Effect.provide(nodeServices)),
  10_000,
);

it.live("decodes UTF-8 after collecting split byte sequences", () =>
  Effect.gen(function* () {
    const smoke = yield* createPackageSmoke(fakePack);
    const code =
      "const bytes = Buffer.from('🙂'); process.stdout.write(bytes.subarray(0, 2)); setTimeout(() => process.stdout.write(bytes.subarray(2)), 25); process.stderr.write('separate');";
    expect(
      yield* smoke.run({
        args: ["-e", code],
        cwd: smoke.workspace,
        executable: process.execPath,
        phase: "utf8",
        timeoutMs: 5000,
      }),
    ).toBe("🙂");
  }).pipe(Effect.scoped, Effect.provide(nodeServices)),
);

it.live.each([
  { code: 0, stdio: "ignore" },
  { code: 0, stdio: "inherit" },
  { code: 7, stdio: "ignore" },
  { code: 7, stdio: "inherit" },
] as const)(
  "terminates descendants after leader exit $code (stdio: $stdio)",
  ({ code, stdio }) =>
    Effect.gen(function* () {
      const smoke = yield* createPackageSmoke(fakePack);
      const ready = `${smoke.workspace}/descendant.pid`;
      const descendant = `${uncooperativeChild}\nsetTimeout(() => process.exit(0), 15000);`;
      const leader = [
        `require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(descendant)}, process.argv[1]], { stdio: '${stdio}' }).unref();`,
        `setInterval(() => { if (require('node:fs').existsSync(process.argv[1])) { process.stdout.write('output'); process.stderr.write('diagnostic'); process.exit(${String(code)}); } }, 10);`,
      ].join("\n");
      const fiber = yield* smoke
        .run({
          args: ["-e", leader, ready],
          cwd: smoke.workspace,
          executable: process.execPath,
          phase: "leader exit",
          timeoutMs: 5000,
        })
        .pipe(Effect.result, Effect.forkChild);
      const pid = yield* waitForPid(ready);
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          try {
            process.kill(pid, "SIGKILL");
          } catch (error) {
            if (!(
              error instanceof Error &&
              "code" in error &&
              error.code === "ESRCH"
            )) {
              throw error;
            }
          }
        }),
      );
      const result = yield* Fiber.join(fiber);
      if (code === 0) {
        expect(result).toMatchObject({ success: "output", _tag: "Success" });
      } else {
        expect(result).toMatchObject({
          failure: {
            exitCode: code,
            stderr: "diagnostic",
            stdout: "output",
            _tag: "CommandFailure",
          },
          _tag: "Failure",
        });
      }
      expect(() => process.kill(pid, 0)).toThrow(
        expect.objectContaining({ code: "ESRCH" }),
      );
    }).pipe(Effect.scoped, Effect.provide(nodeServices)),
  10_000,
);

it.live.each(["cwd", "executable"] as const)(
  "reports a missing %s without hanging during cleanup",
  (missing) =>
    Effect.gen(function* () {
      const smoke = yield* createPackageSmoke(fakePack);
      const absent = `${smoke.workspace}/does-not-exist`;
      const error = yield* smoke
        .run({
          args: ["-e", "process.stdout.write('unexpected');"],
          cwd: missing === "cwd" ? absent : smoke.workspace,
          executable: missing === "executable" ? absent : process.execPath,
          phase: "spawn failure",
          timeoutMs: 2000,
        })
        .pipe(Effect.flip);
      expect(error).toMatchObject({
        phase: "spawn failure",
        _tag: "CommandFailure",
      });
    }).pipe(Effect.scoped, Effect.provide(nodeServices)),
);
