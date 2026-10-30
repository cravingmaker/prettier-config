import { cp, lstat, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import { run } from "./helpers/command.js";
import { peerScenario } from "./helpers/peer-scenarios.js";
import packageJson from "../package.json" with { type: "json" };

type PackResult = { readonly filename: string; readonly files: ReadonlyArray<{ readonly path: string }> };

const projectDirectory = fileURLToPath(new URL("..", import.meta.url));
// CI runs the consumer programs on each supported Node.js, and npm and TypeScript on the development Node.js.
// eslint-disable-next-line n/no-process-env -- CI selects the Node.js of the consumer programs.
const consumerNode = process.env.PRETTIER_CONFIG_CONSUMER_NODE ?? process.execPath;
const workspace = await mkdtemp(path.join(os.tmpdir(), "prettier-config-package-"));

// Packs the package into the workspace, as npm publishes it, and returns the tarball and the files in it.
const pack = async () => {
  const output = await run("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", workspace], { cwd: projectDirectory });
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- `npm pack --json` prints one result for the one package.
  const [{ filename, files }] = JSON.parse(output) as readonly [PackResult];
  return {
    files: files.map((file) => {
      return file.path;
    }),
    tarball: path.join(workspace, filename),
  };
};

// Creates a project that installs the tarball, the scenario's Prettier, and `dependencies` from the registry, as a consumer does,
// and copies `repositoryFiles` into it.
const createConsumer = async (name: string, tarball: string, dependencies: readonly string[], repositoryFiles: readonly string[]) => {
  const consumer = path.join(workspace, name);
  await mkdir(consumer);
  await writeFile(path.join(consumer, "package.json"), JSON.stringify({ name, prettier: packageJson.name, private: true, type: "module" }));
  await run(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--save-exact", tarball, `prettier@${peerScenario.prettier}`, ...dependencies],
    { cwd: consumer, timeout: 120_000 },
  );
  await Promise.all(
    repositoryFiles.map(async (file) => {
      await cp(path.join(projectDirectory, file), path.join(consumer, path.basename(file)));
    }),
  );
  return consumer;
};

// Installs the package in a project without optional plugins and in one with them. A failed setup registers no tests, so it removes the workspace itself.
const setUp = async () => {
  try {
    const { files, tarball } = await pack();
    const baseConsumer = await createConsumer(
      "base-consumer",
      tarball,
      [`typescript@${packageJson.devDependencies.typescript}`],
      [
        "tests/consumers/helpers.mjs",
        "tests/consumers/installed.mjs",
        "tests/consumers/resolution.mjs",
        "tests/fixtures/installed-consumer/tsconfig.json",
        "tests/fixtures/installed-consumer/typecheck.ts",
      ],
    );
    const optionalConsumer = await createConsumer("optional-consumer", tarball, peerScenario.optionalDependencies, [
      "tests/consumers/helpers.mjs",
      "tests/consumers/optional.mjs",
      "tests/consumers/tailwind-config.mjs",
      "tests/consumers/tailwind.mjs",
      "tests/fixtures/tailwind-stylesheet/theme.css",
      "tests/fixtures/tailwind.css",
      "tests/fixtures/tailwind.less",
      "tests/fixtures/tailwind.scss",
      "tests/fixtures/tailwind.vue",
    ]);
    return { baseConsumer, optionalConsumer, packedFiles: files };
  } catch (error) {
    await rm(workspace, { force: true, recursive: true });
    throw error;
  }
};

const { baseConsumer, optionalConsumer, packedFiles } = await setUp();

afterAll(async () => {
  await rm(workspace, { force: true, recursive: true });
});

describe(`the published package (${peerScenario.name} peers, Prettier ${peerScenario.prettier})`, { timeout: 60_000 }, () => {
  it("contains only the runtime, its declarations, the manifest, the README, and the license", () => {
    expect(new Set(packedFiles)).toEqual(new Set(["index.d.ts", "index.mjs", "LICENSE", "package.json", "README.md"]));
  });

  it("installs as a real directory, reports broken optional plugins, and type-checks extensions", async ({ signal }) => {
    const installed = await lstat(path.join(baseConsumer, "node_modules", packageJson.name));
    expect(installed.isSymbolicLink()).toBe(false);
    expect(await run(consumerNode, ["resolution.mjs"], { cwd: baseConsumer, signal })).toBe("ok");
    // TypeScript runs on the development Node.js; only the consumer programs use the selected one.
    expect(await run(process.execPath, ["node_modules/typescript/bin/tsc", "--project", "tsconfig.json"], { cwd: baseConsumer, signal })).toBe("");
  });

  // Prettier resolves the config and its plugins from the formatted file, not from the working directory.
  describe.for(["its project", "another directory"])("run from %s", (location) => {
    it.for([
      { consumer: baseConsumer, program: "installed.mjs", purpose: "formats without optional plugins" },
      { consumer: optionalConsumer, program: "optional.mjs", purpose: "loads the installed optional plugins, Tailwind CSS last" },
      { consumer: optionalConsumer, program: "tailwind.mjs", purpose: "resolves a custom Tailwind CSS stylesheet relative to its config" },
    ])("$purpose", async ({ consumer, program }, { signal }) => {
      const cwd = location === "its project" ? consumer : path.dirname(consumer);
      expect(await run(consumerNode, [path.join(consumer, program), peerScenario.prettier], { cwd, signal })).toBe("ok");
    });
  });
});
