import process from "node:process";
import { fileURLToPath } from "node:url";

import { checkEffectReference } from "./effect-reference-metadata.mjs";

try {
  const reference = await checkEffectReference(
    fileURLToPath(new globalThis.URL("..", import.meta.url)),
  );
  process.stdout.write(
    `Effect ${reference.version} dependency/reference metadata verified\n`,
  );
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
