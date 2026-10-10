import { execFile } from "node:child_process";
import process from "node:process";
import { promisify } from "node:util";

const execute = promisify(execFile);

// https://git-scm.com/docs/githooks: clear repository variables before foreign Git operations.
const foreignGitEnvironment = async () => {
  const { stdout } = await execute("git", ["rev-parse", "--local-env-vars"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024,
    timeout: 10_000,
  });
  const localVariables = new Set(stdout.trim().split("\n"));
  return Object.fromEntries(
    // eslint-disable-next-line n/no-process-env -- Preserve the command environment except Git's own repository-selection variables.
    Object.entries(process.env).filter(([name]) => !localVariables.has(name)),
  );
};

export { foreignGitEnvironment };
