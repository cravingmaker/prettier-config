import { execFile } from "node:child_process";
import process from "node:process";
import { promisify } from "node:util";

import { ensureActionlint, projectDirectory } from "./actionlint.mjs";

const execute = promisify(execFile);
try {
  const binary = await ensureActionlint();
  const { stderr, stdout } = await execute(binary, process.argv.slice(2), {
    cwd: projectDirectory,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    timeout: 30_000,
  });
  process.stdout.write(stdout);
  process.stderr.write(stderr);
} catch (error) {
  if (
    error instanceof Error &&
    "stdout" in error &&
    typeof error.stdout === "string"
  )
    process.stdout.write(error.stdout);
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
