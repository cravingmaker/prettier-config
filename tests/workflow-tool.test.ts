import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import { run } from "./helpers/command.js";
import reference from "../scripts/actionlint-reference.json" with { type: "json" };
import { ensureActionlint } from "../scripts/actionlint.mjs";

const projectDirectory = fileURLToPath(new URL("..", import.meta.url));
const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "prettier-config-workflows-"));

afterAll(async () => {
  await fs.rm(workspace, { force: true, recursive: true });
});

describe("the pinned workflow linter", () => {
  it("fails with actionlint's findings for an invalid workflow", async () => {
    const workflow = path.join(workspace, "invalid.yml");
    await fs.writeFile(
      workflow,
      `on: push\njobs:\n  invalid:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo \${{ needs.absent.outputs.value }}\n`,
    );

    const check = run(process.execPath, ["scripts/check-workflows.mjs", workflow], { cwd: projectDirectory, timeout: 60_000 });
    await expect(check).rejects.toThrow("needs.absent.outputs.value");
    await expect(check).rejects.toMatchObject({ cause: { code: 1 } });
  }, 70_000);

  it("refuses a cached binary that differs from the pin and leaves it in place", async () => {
    const cache = path.join(workspace, ".tools", `actionlint-${reference.version}-${process.platform}-${process.arch}`);
    await fs.mkdir(cache, { recursive: true });
    await fs.writeFile(path.join(cache, "actionlint"), "altered cached binary");

    await expect(ensureActionlint(workspace)).rejects.toThrow("does not match the pinned binary");
    expect(await fs.readFile(path.join(cache, "actionlint"), "utf8")).toBe("altered cached binary");
    expect(await fs.readdir(path.join(workspace, ".tools"))).toEqual([path.basename(cache)]);
  });
});
