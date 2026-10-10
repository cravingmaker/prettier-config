import { execFile, spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

import { Effect, Schema } from "effect";

const commandFields = {
  args: Schema.Array(Schema.String),
  cwd: Schema.String,
  executable: Schema.String,
  message: Schema.String,
  phase: Schema.String,
};

type CommandError = CommandDeadline | CommandFailure | CommandOutputLimit;
type CommandResult = {
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stderr: string;
  readonly stdout: string;
};
type CommandSpec = {
  readonly args: readonly string[];
  readonly cwd: string;
  readonly executable: string;
  readonly phase: string;
  readonly timeoutMs: number;

  readonly env?: NodeJS.ProcessEnv;
};
type OutputBuffer = { chunks: Buffer[]; size: number };

class CommandDeadline extends Schema.TaggedError<CommandDeadline>()(
  "CommandDeadline",
  { ...commandFields, timeoutMs: Schema.Number },
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

const outputLimit = 1024 * 1024;
const terminationGraceMs = 1000;
// eslint-disable-next-line @typescript-eslint/strict-void-return -- promisify uses execFile's callback and intentionally ignores its ChildProcess return value.
const execute = promisify(execFile);

// Native event listeners own the mutable process state; the Effect scope owns disposal.
const startCommand = (spec: CommandSpec) => {
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
  const child = spawn(spec.executable, [...spec.args], {
    cwd: spec.cwd,
    detached: process.platform !== "win32",
    env: spec.env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let closed = false;
  let exited = false;
  let disposal: Promise<void> | undefined;
  const hasLeaderExited = () => exited;

  const isAlive = () => {
    if (child.pid === undefined) return false;
    if (process.platform === "win32") return !exited;
    try {
      process.kill(-child.pid, 0);
      return true;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ESRCH") {
        return false;
      }
      throw error;
    }
  };
  const signal = (name: NodeJS.Signals) => {
    if (child.pid === undefined) return;
    try {
      process.kill(-child.pid, name);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ESRCH") {
        return;
      }
      throw error;
    }
  };
  const hasStopped = () => closed && !isAlive();
  const waitForExit = async () => {
    const deadline = performance.now() + terminationGraceMs;
    while (!hasStopped() && performance.now() < deadline) {
      // eslint-disable-next-line no-await-in-loop -- Poll process state between delays until cleanup completes or its grace period expires.
      await delay(10);
    }
  };
  const dispose = async () => {
    disposal ??= (async () => {
      if (process.platform === "win32") {
        if (!hasLeaderExited() && child.pid !== undefined) {
          try {
            await execute("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
              timeout: terminationGraceMs,
              windowsHide: true,
            });
          } catch (error) {
            if (!hasLeaderExited()) throw error;
          }
        }
      } else {
        signal("SIGTERM");
        await waitForExit();
        if (isAlive()) signal("SIGKILL");
      }
      await waitForExit();
      if (!closed) {
        child.stdout.destroy();
        child.stderr.destroy();
        await waitForExit();
      }
      if (!closed)
        throw new Error(`${spec.phase}: child process did not close`);
    })();
    await disposal;
  };

  // eslint-disable-next-line promise/avoid-new -- Node process events need one completion promise for the scoped Effect bridge.
  const result = new Promise<
    CommandFailure | CommandOutputLimit | CommandResult
  >((resolve) => {
    const stdout: OutputBuffer = { chunks: [], size: 0 };
    const stderr: OutputBuffer = { chunks: [], size: 0 };
    const collect =
      (name: "stderr" | "stdout", buffer: OutputBuffer) => (chunk: Buffer) => {
        if (buffer.size > outputLimit) return;
        buffer.size += chunk.byteLength;
        if (buffer.size > outputLimit) {
          resolve(
            new CommandOutputLimit({
              ...details,
              limit: outputLimit,
              message: `${spec.phase}: ${name} exceeds ${String(outputLimit)} bytes`,
              stream: name,
            }),
          );
        } else {
          buffer.chunks.push(chunk);
        }
      };
    child.stdout.on("data", collect("stdout", stdout));
    child.stderr.on("data", collect("stderr", stderr));
    const onError = (cause: unknown) => {
      resolve(failure(cause));
    };
    child.stdout.on("error", onError);
    child.stderr.on("error", onError);
    child.once("error", onError);
    child.once("exit", () => {
      exited = true;
      // The leader can exit while descendants retain its output pipes or ignore SIGTERM.
      // eslint-disable-next-line promise/prefer-await-to-then, promise/prefer-await-to-callbacks -- Node listeners start disposal; the Effect finalizer awaits the same promise.
      dispose().catch((error: unknown) => {
        resolve(failure(error));
      });
    });
    child.once("close", (code, exitSignal) => {
      closed = true;
      resolve({
        code,
        signal: exitSignal,
        stderr: Buffer.concat(stderr.chunks).toString("utf8"),
        stdout: Buffer.concat(stdout.chunks).toString("utf8"),
      });
    });
  });
  return { dispose, result };
};

const runCommand = Effect.fn("packageSmoke.runCommand")(function* (
  spec: CommandSpec,
) {
  const details = {
    args: [...spec.args],
    cwd: spec.cwd,
    executable: spec.executable,
    phase: spec.phase,
  };
  return yield* Effect.gen(function* () {
    const command = yield* Effect.acquireRelease(
      Effect.try({
        catch: (cause) =>
          new CommandFailure({
            ...details,
            cause,
            message: `${spec.phase}: ${spec.executable} could not start in ${spec.cwd}`,
          }),
        try: () => startCommand(spec),
      }),
      (handle) => Effect.promise(handle.dispose),
    );
    const result = yield* Effect.promise(async () => await command.result);
    if (
      result instanceof CommandFailure ||
      result instanceof CommandOutputLimit
    ) {
      return yield* result;
    }
    if (result.code !== 0) {
      const status =
        result.code === null
          ? `signal ${String(result.signal)}`
          : String(result.code);
      return yield* new CommandFailure({
        ...details,
        cause: new Error(`Exit status ${status}`),
        ...(result.code === null ? {} : { exitCode: result.code }),
        message: `${spec.phase}: ${spec.executable} exited with ${status} in ${spec.cwd}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
        stderr: result.stderr,
        stdout: result.stdout,
      });
    }
    return result.stdout;
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

export { CommandDeadline, CommandFailure, CommandOutputLimit, runCommand };
export type { CommandError, CommandSpec };
