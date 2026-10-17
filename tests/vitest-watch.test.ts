import { once } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { createVitest, parseCLI } from "vitest/node";

import packageJson from "../package.json" with { type: "json" };

const directory = fileURLToPath(new URL("..", import.meta.url));
const packageTest = "tests/package.smoke.test.ts";
const testFiles = ["tests/config.test.ts", "tests/format.test.ts", packageTest, "tests/tooling-guards.test.ts"];
const changes = [
  {
    filename: "tests/fixtures/sample.ts",
    tests: ["tests/format.test.ts", packageTest],
  },
  {
    filename: "index.mjs",
    tests: ["tests/config.test.ts", "tests/format.test.ts", packageTest, "tests/tooling-guards.test.ts"],
  },
  {
    filename: "index.d.ts",
    tests: [packageTest, "tests/tooling-guards.test.ts"],
  },
  { filename: "tests/consumers/installed.mjs", tests: [packageTest] },
];

const collectTestFiles = async (command: string) => {
  const { filter, options } = parseCLI(command);
  const runner = await createVitest({
    ...options,
    root: directory,
    watch: false,
  });
  try {
    const specifications = await runner.globTestSpecifications(filter);
    return specifications.map((specification) => path.relative(directory, specification.moduleId));
  } finally {
    await runner.close();
  }
};

describe("Vitest watch dependencies", () => {
  it("partitions regular tests into runtime and tooling suites without losing coverage", async () => {
    const [regular, runtime, tooling] = await Promise.all([
      collectTestFiles(packageJson.scripts.test),
      collectTestFiles(packageJson.scripts["test:runtime"]),
      collectTestFiles(packageJson.scripts["test:tooling"]),
    ]);

    expect(tooling).toEqual(["tests/tooling-guards.test.ts"]);
    expect(runtime).not.toContain("tests/tooling-guards.test.ts");
    expect(runtime).not.toContain(packageTest);
    expect(regular).toHaveLength(runtime.length + tooling.length);
    expect(regular).toEqual(expect.arrayContaining(runtime));
    expect(regular).toEqual(expect.arrayContaining(tooling));
  });

  it.each(["package", "regular"] as const)(
    "reruns tests for filesystem inputs within the %s command's scope",
    async (scenario) => {
      const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "prettier-watch-"));
      const workspace = await fs.realpath(temporaryDirectory);
      const selectedTests = testFiles.filter((filename) => (scenario === "package" ? filename === packageTest : filename !== packageTest));
      const reports = new EventTarget();
      const { filter, options } = parseCLI(packageJson.scripts[scenario === "package" ? "test:package:ui" : "test:ui"]);

      try {
        await fs.copyFile(path.join(directory, "vitest.config.ts"), path.join(workspace, "vitest.config.ts"));
        await fs.symlink(path.join(directory, "node_modules"), path.join(workspace, "node_modules"), "junction");
        await fs.writeFile(path.join(workspace, "package.json"), '{"type":"module"}');
        await fs.mkdir(path.join(workspace, "tests"));
        await Promise.all(
          testFiles.map(async (filename) => {
            await fs.writeFile(
              path.join(workspace, filename),
              'import { expect, it } from "vitest"; it("runs", () => { expect(true).toBe(true); });',
            );
          }),
        );
        await Promise.all(
          changes.map(async ({ filename }) => {
            const target = path.join(workspace, filename);
            await fs.mkdir(path.dirname(target), { recursive: true });
            await fs.writeFile(target, "// initial input\n");
          }),
        );

        const runner = await createVitest({
          ...options,
          config: path.join(workspace, "vitest.config.ts"),
          maxWorkers: 1,
          open: false,
          reporters: [
            {
              onTestRunEnd(modules, errors, reason) {
                const files = new Set(modules.map((module) => path.relative(workspace, module.moduleId)));
                reports.dispatchEvent(
                  new CustomEvent("complete", {
                    detail: {
                      errors,
                      files,
                      reason,
                    },
                  }),
                );
              },
            },
          ],
          root: workspace,
          ui: false,
        });

        try {
          const initial = once(reports, "complete", {
            signal: AbortSignal.timeout(20_000),
          });
          await runner.start(filter);
          const initialReports: readonly unknown[] = await initial;
          expect(initialReports[0]).toHaveProperty("detail", {
            errors: [],
            files: new Set(selectedTests),
            reason: "passed",
          });

          /* eslint-disable functional/no-loop-statements, no-await-in-loop -- Each filesystem edit must finish its watcher run before the next input changes. */
          for (const change of changes) {
            const expected = change.tests.filter((filename) => selectedTests.includes(filename));
            if (expected.length === 0) continue;

            const completed = once(reports, "complete", {
              signal: AbortSignal.timeout(10_000),
            });
            await fs.appendFile(path.join(workspace, change.filename), "// changed input\n");
            const completedReports: readonly unknown[] = await completed;
            expect(completedReports[0], `rerun after changing ${change.filename}`).toHaveProperty("detail", {
              errors: [],
              files: new Set(expected),
              reason: "passed",
            });
          }
          /* eslint-enable functional/no-loop-statements, no-await-in-loop -- Restore the style guards after sequential watcher checks. */
        } finally {
          await runner.close();
        }
      } finally {
        await fs.rm(workspace, { force: true, recursive: true });
      }
    },
    40_000,
  );
});
