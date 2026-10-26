import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { Effect } from "effect";

// Native I/O must settle before a surrounding scope removes its workspace.
const operation = <A>(run: () => Promise<A>) => {
  return Effect.tryPromise(run).pipe(Effect.uninterruptible);
};

const nodeFileSystem = {
  copyFile: (source: string, destination: string) => {
    return operation(async () => {
      await fs.copyFile(source, destination);
    });
  },
  exists: (filename: string) => {
    return operation(async () => {
      try {
        await fs.access(filename);
        return true;
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
          return false;
        }
        throw error;
      }
    });
  },
  makeDirectory: (directory: string) => {
    return operation(async () => {
      await fs.mkdir(directory);
    });
  },
  makeTempDirectory: (options: { readonly prefix: string }) => {
    return operation(async () => {
      return await fs.mkdtemp(path.join(os.tmpdir(), options.prefix));
    });
  },
  readDirectory: (directory: string) => {
    return operation(async () => {
      return await fs.readdir(directory);
    });
  },
  readFileString: (filename: string) => {
    return operation(async () => {
      return await fs.readFile(filename, "utf8");
    });
  },
  realPath: (filename: string) => {
    return operation(async () => {
      return await fs.realpath(filename);
    });
  },
  remove: (filename: string, options: { readonly force: boolean; readonly recursive: boolean }) => {
    return operation(async () => {
      await fs.rm(filename, options);
    });
  },
  writeFileString: (filename: string, contents: string) => {
    return operation(async () => {
      await fs.writeFile(filename, contents, "utf8");
    });
  },
};

export { nodeFileSystem };
