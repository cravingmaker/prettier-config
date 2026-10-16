import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { Effect } from "effect";

// Native I/O must settle before a surrounding scope removes its workspace.
const operation = <A>(run: () => Promise<A>) => Effect.tryPromise(run).pipe(Effect.uninterruptible);

const nodeFileSystem = {
  copyFile: (source: string, destination: string) =>
    operation(async () => {
      await fs.copyFile(source, destination);
    }),
  exists: (filename: string) =>
    operation(async () => {
      try {
        await fs.access(filename);
        return true;
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
        throw error;
      }
    }),
  makeDirectory: (directory: string) =>
    operation(async () => {
      await fs.mkdir(directory);
    }),
  makeTempDirectory: (options: { readonly prefix: string }) =>
    operation(async () => await fs.mkdtemp(path.join(os.tmpdir(), options.prefix))),
  readDirectory: (directory: string) => operation(async () => await fs.readdir(directory)),
  readFileString: (filename: string) => operation(async () => await fs.readFile(filename, "utf8")),
  realPath: (filename: string) => operation(async () => await fs.realpath(filename)),
  remove: (filename: string, options: { readonly force: boolean; readonly recursive: boolean }) =>
    operation(async () => {
      await fs.rm(filename, options);
    }),
  writeFileString: (filename: string, contents: string) =>
    operation(async () => {
      await fs.writeFile(filename, contents, "utf8");
    }),
};

export { nodeFileSystem };
