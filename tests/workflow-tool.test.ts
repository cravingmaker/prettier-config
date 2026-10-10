import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { runCommand } from "./helpers/node-command.js";
import reference from "../scripts/actionlint-reference.json" with { type: "json" };
import { ensureActionlint } from "../scripts/actionlint.mjs";

const directory = fileURLToPath(new URL("..", import.meta.url));

describe("pinned workflow tool", () => {
  it("uses the pinned binary instead of a global installation", async () => {
    const output = await Effect.runPromise(
      runCommand({
        args: ["scripts/check-workflows.mjs", "-version"],
        cwd: directory,
        executable: process.execPath,
        phase: "workflow tool version",
        timeoutMs: 60_000,
      }),
    );
    expect(output.split("\n")[0]).toBe(reference.version);
  }, 70_000);

  it.each(["imaginary.field", "needs.absent.outputs.value"])(
    "rejects an invalid workflow expression: %s",
    async (expression) => {
      const workspace = await fs.mkdtemp(
        path.join(os.tmpdir(), "prettier-workflow-"),
      );
      try {
        const filename = path.join(workspace, "invalid.yml");
        await fs.writeFile(
          filename,
          `name: invalid\non: push\njobs:\n  invalid:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo \${{ ${expression} }}\n`,
        );
        const error = await Effect.runPromise(
          runCommand({
            args: ["scripts/check-workflows.mjs", filename],
            cwd: directory,
            executable: process.execPath,
            phase: "invalid workflow regression",
            timeoutMs: 60_000,
          }).pipe(Effect.flip),
        );
        expect(error).toMatchObject({ exitCode: 1, _tag: "CommandFailure" });
        expect(
          error._tag === "CommandFailure"
            ? `${error.stdout ?? ""}\n${error.stderr ?? ""}`
            : undefined,
        ).toContain(expression);
      } finally {
        await fs.rm(workspace, { force: true, recursive: true });
      }
    },
    70_000,
  );

  it("refuses altered cached tooling without replacing user content", async () => {
    const workspace = await fs.mkdtemp(
      path.join(os.tmpdir(), "prettier-workflow-cache-"),
    );
    try {
      const cache = path.join(
        workspace,
        ".tools",
        `actionlint-${reference.version}-${process.platform}-${process.arch}`,
      );
      const binary = path.join(cache, "actionlint");
      await fs.mkdir(cache, { recursive: true });
      await fs.writeFile(binary, "altered cached binary");
      await expect(ensureActionlint(workspace)).rejects.toThrow(
        "does not match the pinned binary",
      );
      expect(await fs.readFile(binary, "utf8")).toBe("altered cached binary");
      expect(await fs.readdir(path.join(workspace, ".tools"))).toEqual([
        path.basename(cache),
      ]);
    } finally {
      await fs.rm(workspace, { force: true, recursive: true });
    }
  });
});
