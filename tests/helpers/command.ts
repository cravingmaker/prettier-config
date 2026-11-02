import { execFile } from "node:child_process";
import { promisify } from "node:util";

type RunOptions = {
  readonly cwd: string;

  readonly signal?: AbortSignal;
  readonly timeout?: number;
};

// eslint-disable-next-line @typescript-eslint/strict-void-return -- promisify takes the callback form of execFile, which also returns its child process.
const execute = promisify(execFile);

// What a failed command printed, which Node attaches to its error.
const printed = (error: unknown) => {
  if (typeof error !== "object" || error === null) {
    return "";
  }
  const stdout = "stdout" in error && typeof error.stdout === "string" ? error.stdout : "";
  const stderr = "stderr" in error && typeof error.stderr === "string" ? error.stderr : "";
  return `${stdout}${stderr}`;
};

/**
 * Runs a program and returns its standard output. The program is stopped at its deadline or when `signal` aborts.
 * A failure reports the command, its working directory, and both output streams: TypeScript and actionlint print their findings to standard output.
 */
const run = async (file: string, commandArguments: readonly string[], { cwd, signal, timeout = 30_000 }: RunOptions) => {
  try {
    const { stdout } = await execute(file, commandArguments, { cwd, signal, timeout });
    return stdout;
  } catch (error) {
    throw new Error(`${[file, ...commandArguments].join(" ")} failed in ${cwd}\n${printed(error)}`, { cause: error });
  }
};

export { run };
