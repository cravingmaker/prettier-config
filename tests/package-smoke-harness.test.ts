import { Cause, Effect, Exit, Fiber, Ref, Schedule, Schema } from "effect";
import { expect, it, vi } from "vitest";

import { nodeFileSystem } from "./helpers/node-files.js";
import { createPackageSmoke, runCommand, SmokeFileSystemError } from "./helpers/package-smoke.js";
import { runEffect } from "./helpers/test-effect.js";

const writeArchive = Effect.fnUntraced(function* (workspace: string, filename: string) {
  const fs = nodeFileSystem;
  yield* fs.writeFileString(`${workspace}/${filename}`, "test archive").pipe(
    Effect.mapError((cause) => {
      return new SmokeFileSystemError({
        cause,
        message: "Test archive could not be written",
        path: workspace,
        phase: "test pack",
      });
    }),
  );
});
const fakePack = (workspace: string) => {
  return writeArchive(workspace, "package.tgz");
};

const waitForPid = Effect.fnUntraced(function* (filename: string) {
  const fs = nodeFileSystem;
  yield* fs.exists(filename).pipe(
    Effect.repeat({
      schedule: Schedule.spaced("10 millis"),
      until: (exists) => {
        return exists;
      },
    }),
    Effect.timeout("5 seconds"),
  );
  return yield* Schema.decodeUnknownEffect(Schema.NumberFromString)(yield* fs.readFileString(filename));
});

const uncooperativeChild = [
  "process.on('SIGTERM', () => {});",
  "require('node:fs').writeFileSync(process.argv[1], String(process.pid));",
  "setInterval(() => {}, 1000);",
].join("\n");

const killIfRunning = (pid: number) => {
  try {
    process.kill(pid, "SIGKILL");
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) {
      throw error;
    }
  }
};

it("removes the workspace before propagating a packing failure", async (context) => {
  await runEffect(
    context,
    Effect.gen(function* () {
      const fs = nodeFileSystem;
      const workspaceRef = yield* Ref.make("");
      const error = yield* createPackageSmoke(
        Effect.fnUntraced(function* (workspace) {
          yield* Ref.set(workspaceRef, workspace);
          yield* runCommand({
            args: ["-e", "process.stderr.write('packing failed'); process.exit(7);"],
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
    }).pipe(Effect.scoped),
  );
}, 10_000);

it.for([0, 2])("removes the workspace when packing produces %s tarballs", async (count, context) => {
  await runEffect(
    context,
    Effect.gen(function* () {
      const fs = nodeFileSystem;
      const workspaceRef = yield* Ref.make("");
      const error = yield* createPackageSmoke(
        Effect.fnUntraced(function* (workspace) {
          yield* Ref.set(workspaceRef, workspace);
          yield* Effect.forEach(
            Array.from({ length: count }, (_, index) => {
              return index;
            }),
            (index) => {
              return writeArchive(workspace, `${String(index)}.tgz`);
            },
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
    }).pipe(Effect.scoped),
  );
});

it("retains command arguments, exit status, and both output streams", async (context) => {
  await runEffect(
    context,
    Effect.gen(function* () {
      const smoke = yield* createPackageSmoke(fakePack);
      const arguments_ = ["-e", "process.stdout.write('output'); process.stderr.write('diagnostic'); process.exit(9);"];
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
    }).pipe(Effect.scoped),
  );
});

it("keeps the shared workspace across commands and removes it on disposal", async (context) => {
  await runEffect(
    context,
    Effect.gen(function* () {
      const fs = nodeFileSystem;
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
          expect(yield* smoke.run(spec)).toBe(yield* fs.realPath(smoke.workspace));
          expect(yield* smoke.run(spec)).toBe(yield* fs.realPath(smoke.workspace));
          expect(yield* fs.exists(smoke.workspace)).toBe(true);
          return smoke.workspace;
        }),
      );
      expect(yield* fs.exists(workspace)).toBe(false);
    }),
  );
}, 10_000);

it("waits for forced termination before returning a deadline failure", async (context) => {
  await runEffect(
    context,
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
      expect(() => {
        return process.kill(pid, 0);
      }).toThrow(expect.objectContaining({ code: "ESRCH" }));
    }).pipe(Effect.scoped),
  );
}, 10_000);

it("releases an interrupted process before disposing the suite workspace", async (context) => {
  await runEffect(
    context,
    Effect.gen(function* () {
      const fs = nodeFileSystem;
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
          expect(() => {
            return process.kill(pid, 0);
          }).toThrow(expect.objectContaining({ code: "ESRCH" }));
          expect(yield* fs.exists(smoke.workspace)).toBe(true);
          return smoke.workspace;
        }),
      );
      expect(yield* fs.exists(workspace)).toBe(false);
    }),
  );
}, 10_000);

it.for([
  { afterKill: false, label: "a live group probe", signal: 0 },
  { afterKill: false, label: "SIGKILL during reaping", signal: "SIGKILL" },
  { afterKill: false, label: "SIGTERM during reaping", signal: "SIGTERM" },
  { afterKill: true, label: "a reaping group probe", signal: 0 },
] as const)(
  "preserves deadline cleanup after transient EPERM from $label",
  { timeout: 10_000 },
  // eslint-disable-next-line max-lines-per-function -- Keep the live signal spy, interrupted command, and awaited finalizers in one test lifetime.
  async ({ afterKill, signal: deniedSignal }, context) => {
    await runEffect(
      context,
      Effect.gen(function* () {
        const smoke = yield* createPackageSmoke(fakePack);
        const ready = `${smoke.workspace}/ready`;
        const code = deniedSignal === "SIGTERM" ? uncooperativeChild.replace("process.on('SIGTERM', () => {});", "") : uncooperativeChild;
        const fiber = yield* smoke
          .run({
            args: ["-e", code, ready],
            cwd: smoke.workspace,
            executable: process.execPath,
            phase: "reaping group",
            timeoutMs: 2000,
          })
          .pipe(Effect.flip, Effect.forkChild);
        const pid = yield* waitForPid(ready);
        yield* Effect.addFinalizer(() => {
          return Effect.sync(() => {
            killIfRunning(pid);
          });
        });
        const nativeKill = process.kill.bind(process);
        const deny = vi.fn(() => {
          throw Object.assign(new Error("group is being reaped"), {
            code: "EPERM",
          });
        });
        const spy = vi.spyOn(process, "kill");
        spy.mockImplementation((target, signal) => {
          const isFirstDeniedSignal = target === -pid && signal === deniedSignal && deny.mock.calls.length === 0;
          if (
            isFirstDeniedSignal &&
            (!afterKill ||
              spy.mock.calls.some(([group, sent]) => {
                return group === -pid && sent === "SIGKILL";
              }))
          ) {
            if (signal !== 0) {
              nativeKill(target, signal);
            }
            return deny();
          }
          return nativeKill(target, signal);
        });
        yield* Effect.addFinalizer(() => {
          return Effect.sync(() => {
            spy.mockRestore();
          });
        });
        expect(yield* Fiber.join(fiber)).toMatchObject({
          phase: "reaping group",
          _tag: "CommandDeadline",
          timeoutMs: 2000,
        });
        expect(deny).toHaveBeenCalledOnce();
        expect(() => {
          return nativeKill(pid, 0);
        }).toThrow(expect.objectContaining({ code: "ESRCH" }));
      }).pipe(Effect.scoped),
    );
  },
);

it("retains successful output while a process group is being reaped", async (context) => {
  await runEffect(
    context,
    Effect.gen(function* () {
      const smoke = yield* createPackageSmoke(fakePack);
      const nativeKill = process.kill.bind(process);
      const deny = vi.fn(() => {
        throw Object.assign(new Error("group is being reaped"), {
          code: "EPERM",
        });
      });
      const spy = vi.spyOn(process, "kill").mockImplementation((pid, signal) => {
        return pid < 0 && signal === 0 && deny.mock.calls.length === 0 ? deny() : nativeKill(pid, signal);
      });
      yield* Effect.addFinalizer(() => {
        return Effect.sync(() => {
          spy.mockRestore();
        });
      });
      expect(
        yield* smoke.run({
          args: ["-e", "process.stdout.write('finished');"],
          cwd: smoke.workspace,
          executable: process.execPath,
          phase: "successful reaping",
          timeoutMs: 5000,
        }),
      ).toBe("finished");
      expect(deny).toHaveBeenCalledOnce();
    }).pipe(Effect.scoped),
  );
});

it("preserves permission errors when the process group remains alive", async (context) => {
  await runEffect(
    context,
    Effect.gen(function* () {
      const smoke = yield* createPackageSmoke(fakePack);
      const ready = `${smoke.workspace}/ready`;
      const nativeKill = process.kill.bind(process);
      const denied = Object.assign(new Error("group is still protected"), {
        code: "EPERM",
      });
      const spy = vi.spyOn(process, "kill").mockImplementation((target, signal) => {
        if (target < 0 && signal === "SIGTERM") {
          throw denied;
        }
        return nativeKill(target, signal);
      });
      yield* Effect.addFinalizer(() => {
        return Effect.sync(() => {
          spy.mockRestore();
        });
      });
      const descendant = `${uncooperativeChild}\nsetTimeout(() => process.exit(0), 15000);`;
      const leader = [
        `require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(descendant)}, process.argv[1]], { stdio: 'ignore' }).unref();`,
        "setInterval(() => { if (require('node:fs').existsSync(process.argv[1])) process.exit(0); }, 10);",
      ].join("\n");
      const fiber = yield* smoke
        .run({
          args: ["-e", leader, ready],
          cwd: smoke.workspace,
          executable: process.execPath,
          phase: "denied group",
          timeoutMs: 5000,
        })
        .pipe(Effect.exit, Effect.forkChild);
      const pid = yield* waitForPid(ready);
      yield* Effect.addFinalizer(() => {
        return Effect.sync(() => {
          killIfRunning(pid);
        });
      });
      const result = yield* Fiber.join(fiber);
      expect(Exit.isFailure(result)).toBe(true);
      expect(
        Exit.match(result, {
          onFailure: Cause.pretty,
          onSuccess: () => {
            return "";
          },
        }),
      ).toContain(denied.message);
      expect(nativeKill(pid, 0)).toBe(true);
    }).pipe(Effect.scoped),
  );
}, 10_000);

it.for(["stderr", "stdout"] as const)("limits %s output and terminates the child", { timeout: 10_000 }, async (stream, context) => {
  await runEffect(
    context,
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
      expect(() => {
        return process.kill(pid, 0);
      }).toThrow(expect.objectContaining({ code: "ESRCH" }));
    }).pipe(Effect.scoped),
  );
});

it("decodes UTF-8 after collecting split byte sequences", async (context) => {
  await runEffect(
    context,
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
    }).pipe(Effect.scoped),
  );
});

it.for([0, 9])("preserves UTF-8 byte order marks and incomplete sequences on exit %s", async (code, context) => {
  await runEffect(
    context,
    Effect.gen(function* () {
      const smoke = yield* createPackageSmoke(fakePack);
      const result = yield* smoke
        .run({
          args: [
            "-e",
            `process.stdout.write(new Uint8Array([0xEF, 0xBB, 0xBF, 0xF0, 0x9F, 0x99, 0x82, 0xE2])); process.stderr.write(new Uint8Array([0xEF, 0xBB, 0xBF, 0xE2])); process.exitCode = ${String(code)};`,
          ],
          cwd: smoke.workspace,
          executable: process.execPath,
          phase: "utf8 byte preservation",
          timeoutMs: 5000,
        })
        .pipe(
          Effect.match({
            onFailure: (error) => {
              return { error };
            },
            onSuccess: (stdout) => {
              return { stdout };
            },
          }),
        );
      if ("stdout" in result) {
        expect(code).toBe(0);
        expect(result.stdout).toBe("\u{FEFF}🙂\u{FFFD}");
      } else {
        expect(result.error).toMatchObject({
          exitCode: code,
          stderr: "\u{FEFF}\u{FFFD}",
          stdout: "\u{FEFF}🙂\u{FFFD}",
          _tag: "CommandFailure",
        });
      }
    }).pipe(Effect.scoped),
  );
});

it.for([
  { code: 0, stdio: "ignore" },
  { code: 0, stdio: "inherit" },
  { code: 7, stdio: "ignore" },
  { code: 7, stdio: "inherit" },
] as const)("terminates descendants after leader exit $code (stdio: $stdio)", { timeout: 10_000 }, async ({ code, stdio }, context) => {
  await runEffect(
    context,
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
      yield* Effect.addFinalizer(() => {
        return Effect.sync(() => {
          killIfRunning(pid);
        });
      });
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
      expect(() => {
        return process.kill(pid, 0);
      }).toThrow(expect.objectContaining({ code: "ESRCH" }));
    }).pipe(Effect.scoped),
  );
});

it.for(["cwd", "executable"] as const)("reports a missing %s without hanging during cleanup", async (missing, context) => {
  await runEffect(
    context,
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
    }).pipe(Effect.scoped),
  );
});
