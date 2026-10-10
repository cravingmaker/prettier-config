import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { runCommand } from "./helpers/node-command.js";
import packageJson from "../package.json" with { type: "json" };
import { effectPackages } from "../scripts/effect-reference-metadata.mjs";
import reference from "../scripts/effect-reference.json" with { type: "json" };
import { foreignGitEnvironment } from "../scripts/git-environment.mjs";

const directory = fileURLToPath(new URL("..", import.meta.url));
const environment = await foreignGitEnvironment();
const names = [
  "effect",
  "@effect/platform-node-shared",
  "@effect/vitest",
] as const;
const dependencies = Object.fromEntries(
  names.map((name) => [name, reference.version]),
);
const lockfile = {
  lockfileVersion: 3,
  packages: Object.fromEntries<unknown>([
    ["", { devDependencies: dependencies }],
    ...names.map(
      (name) =>
        [`node_modules/${name}`, { version: reference.version }] as const,
    ),
  ]),
};
const run = (
  root: string,
  arguments_: readonly string[],
  executable = process.execPath,
  environment_ = environment,
) =>
  runCommand({
    args: arguments_,
    cwd: root,
    env: environment_,
    executable,
    phase: "reference fixture",
    timeoutMs: 30_000,
  });
const writeJson = async (root: string, filename: string, value: unknown) => {
  await fs.writeFile(path.join(root, filename), JSON.stringify(value));
};
const withProject = async (check: (root: string) => Promise<void>) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "prettier-reference-"));
  try {
    await fs.cp(path.join(directory, "scripts"), path.join(root, "scripts"), {
      recursive: true,
    });
    await fs.symlink(
      path.join(directory, "node_modules"),
      path.join(root, "node_modules"),
      "junction",
    );
    await writeJson(root, "package.json", {
      devDependencies: dependencies,
      scripts: Object.fromEntries(
        Object.entries(packageJson.scripts).map(([name, command]) => [
          name,
          name === "validate" || name === "check:effect-reference"
            ? command
            : 'node -e ""',
        ]),
      ),
      type: "module",
    });
    await writeJson(root, "package-lock.json", lockfile);
    await check(root);
  } finally {
    await fs.rm(root, { force: true, recursive: true });
  }
};
const checkFailure = async (
  root: string,
  arguments_: readonly string[],
  message: string,
  executable?: string,
) => {
  const error = await Effect.runPromise(
    run(root, arguments_, executable).pipe(Effect.flip),
  );
  expect(error).toMatchObject({ exitCode: 1, _tag: "CommandFailure" });
  expect(error._tag === "CommandFailure" ? error.stderr : undefined).toContain(
    message,
  );
};

const defaultManifest = { name: "effect", version: reference.version };
const makeRepository = async (
  root: string,
  effectManifest: unknown = defaultManifest,
) => {
  const repository = path.join(root, "source");
  await fs.mkdir(repository);
  await Promise.all(
    effectPackages.map(async ({ manifest, name }) => {
      await fs.mkdir(path.dirname(path.join(repository, manifest)), {
        recursive: true,
      });
      await writeJson(
        repository,
        manifest,
        name === "effect"
          ? effectManifest
          : { name, version: reference.version },
      );
    }),
  );
  await Effect.runPromise(
    run(repository, ["init", "--initial-branch=main"], "git"),
  );
  await Effect.runPromise(run(repository, ["add", "."], "git"));
  await Effect.runPromise(
    run(
      repository,
      [
        "-c",
        "core.hooksPath=/dev/null",
        "-c",
        "commit.gpgsign=false",
        "-c",
        "user.name=Reference Fixture",
        "-c",
        "user.email=fixture@example.invalid",
        "commit",
        "-m",
        "fixture",
      ],
      "git",
    ),
  );
  const commit = await Effect.runPromise(
    run(repository, ["rev-parse", "HEAD"], "git"),
  );
  await Effect.runPromise(run(repository, ["tag", reference.tag], "git"));
  await writeJson(root, "scripts/effect-reference.json", {
    ...reference,
    commit: commit.trim(),
    repository,
  });
  return repository;
};

describe("Effect reference metadata", () => {
  it("checks consistent metadata offline without creating repos/", async () => {
    await withProject(async (root) => {
      expect(
        await Effect.runPromise(
          run(root, ["scripts/check-effect-reference.mjs"]),
        ),
      ).toContain(
        `Effect ${reference.version} dependency/reference metadata verified`,
      );
      await expect(fs.lstat(path.join(root, "repos"))).rejects.toMatchObject({
        code: "ENOENT",
      });
    });
  });

  it("makes the complete validate command reject drift before its other checks", async () => {
    await withProject(async (root) => {
      await writeJson(root, "scripts/effect-reference.json", {
        ...reference,
        tag: "effect@4.0.1",
        version: "4.0.1",
      });
      await checkFailure(root, ["run", "validate"], "package.json", "npm");
    });
  });

  it.each(names)("rejects a mismatched declared %s pin", async (name) => {
    await withProject(async (root) => {
      await writeJson(root, "package.json", {
        devDependencies: { ...dependencies, [name]: "^4.0.0" },
      });
      await checkFailure(root, ["scripts/check-effect-reference.mjs"], name);
    });
  });

  it.each(names)(
    "rejects a mismatched installed %s lock record",
    async (name) => {
      await withProject(async (root) => {
        await writeJson(root, "package-lock.json", {
          ...lockfile,
          packages: {
            ...lockfile.packages,
            [`node_modules/${name}`]: { version: "4.0.1" },
          },
        });
        await checkFailure(
          root,
          ["scripts/check-effect-reference.mjs"],
          `node_modules/${name}`,
        );
      });
    },
  );

  it("rejects mismatched root lockfile dependency declarations", async () => {
    await withProject(async (root) => {
      await writeJson(root, "package-lock.json", {
        ...lockfile,
        packages: {
          ...lockfile.packages,
          ...Object.fromEntries<unknown>([
            ["", { devDependencies: { ...dependencies, effect: "4.0.1" } }],
          ]),
        },
      });
      await checkFailure(
        root,
        ["scripts/check-effect-reference.mjs"],
        "root lockfile",
      );
    });
  });

  it.each([
    { commit: "short" },
    { tag: "effect@3.0.0" },
    { version: "^4.0.0" },
    // eslint-disable-next-line unicorn/no-null -- JSON null must fail the external metadata schema.
    { repository: null },
  ])("rejects invalid reference metadata: %j", async (invalid) => {
    await withProject(async (root) => {
      await writeJson(root, "scripts/effect-reference.json", {
        ...reference,
        ...invalid,
      });
      await checkFailure(
        root,
        ["scripts/check-effect-reference.mjs"],
        "effect-reference.json",
      );
    });
  });
});

describe("Effect reference setup in disposable repositories", () => {
  it("ignores an inherited hook's repository and index variables", async () => {
    await withProject(async (root) => {
      const repository = await makeRepository(root);
      const before = await Effect.runPromise(
        run(repository, ["rev-parse", "HEAD"], "git"),
      );
      const gitDirectory = path.join(repository, ".git");
      const output = await Effect.runPromise(
        run(root, ["scripts/setup-effect-reference.mjs"], process.execPath, {
          ...environment,
          ...Object.fromEntries([
            ["GIT_COMMON_DIR", gitDirectory],
            ["GIT_DIR", gitDirectory],
            ["GIT_INDEX_FILE", path.join(gitDirectory, "index")],
            ["GIT_WORK_TREE", repository],
          ]),
        }),
      );
      expect(output).toContain("reference ready");
      expect(
        await Effect.runPromise(run(repository, ["rev-parse", "HEAD"], "git")),
      ).toBe(before);
      expect(
        await Effect.runPromise(
          run(repository, ["status", "--porcelain"], "git"),
        ),
      ).toBe("");
      expect(await fs.readdir(path.join(root, "repos"))).toEqual(["effect"]);
    });
  });
  it("clones and verifies the pinned local source without changing it", async () => {
    await withProject(async (root) => {
      const repository = await makeRepository(root);
      expect(
        await Effect.runPromise(
          run(root, ["scripts/setup-effect-reference.mjs"]),
        ),
      ).toContain("reference ready");
      expect(
        await Effect.runPromise(
          run(root, ["scripts/setup-effect-reference.mjs"]),
        ),
      ).toContain("reference verified");
      expect(
        await Effect.runPromise(
          run(repository, ["status", "--porcelain"], "git"),
        ),
      ).toBe("");
      expect(await fs.readdir(path.join(root, "repos"))).toEqual(["effect"]);
    });
  });

  it("preserves a dirty existing checkout", async () => {
    await withProject(async (root) => {
      await makeRepository(root);
      await Effect.runPromise(
        run(root, ["scripts/setup-effect-reference.mjs"]),
      );
      const marker = path.join(root, "repos/effect/user-work.txt");
      await fs.writeFile(marker, "keep this work");
      await checkFailure(
        root,
        ["scripts/setup-effect-reference.mjs"],
        "local changes",
      );
      expect(await fs.readFile(marker, "utf8")).toBe("keep this work");
    });
  });

  it("preserves a checkout at a different commit", async () => {
    await withProject(async (root) => {
      await makeRepository(root);
      await Effect.runPromise(
        run(root, ["scripts/setup-effect-reference.mjs"]),
      );
      const checkout = path.join(root, "repos/effect");
      await Effect.runPromise(
        run(
          checkout,
          [
            "-c",
            "core.hooksPath=/dev/null",
            "-c",
            "commit.gpgsign=false",
            "-c",
            "user.name=Reference Fixture",
            "-c",
            "user.email=fixture@example.invalid",
            "commit",
            "--allow-empty",
            "-m",
            "user commit",
          ],
          "git",
        ),
      );
      const head = await Effect.runPromise(
        run(checkout, ["rev-parse", "HEAD"], "git"),
      );
      await checkFailure(
        root,
        ["scripts/setup-effect-reference.mjs"],
        "commit differs",
      );
      expect(
        await Effect.runPromise(run(checkout, ["rev-parse", "HEAD"], "git")),
      ).toBe(head);
    });
  });

  it("preserves a checkout with an unexpected origin", async () => {
    await withProject(async (root) => {
      await makeRepository(root);
      await Effect.runPromise(
        run(root, ["scripts/setup-effect-reference.mjs"]),
      );
      const checkout = path.join(root, "repos/effect");
      await Effect.runPromise(
        run(
          checkout,
          ["remote", "set-url", "origin", "https://example.invalid/user.git"],
          "git",
        ),
      );
      await checkFailure(
        root,
        ["scripts/setup-effect-reference.mjs"],
        "origin differs",
      );
      const origin = await Effect.runPromise(
        run(checkout, ["remote", "get-url", "origin"], "git"),
      );
      expect(origin.trim()).toBe("https://example.invalid/user.git");
    });
  });

  it.each(["repos", "repos/effect"])(
    "refuses a symlink at %s and preserves its target",
    async (location) => {
      await withProject(async (root) => {
        const target = path.join(root, "user-directory");
        await fs.mkdir(target);
        await fs.writeFile(path.join(target, "marker"), "keep");
        if (location === "repos/effect")
          await fs.mkdir(path.join(root, "repos"));
        await fs.symlink(target, path.join(root, location), "junction");
        await checkFailure(
          root,
          ["scripts/setup-effect-reference.mjs"],
          location === "repos"
            ? "Expected a real directory"
            : "Unexpected content",
        );
        expect(await fs.readFile(path.join(target, "marker"), "utf8")).toBe(
          "keep",
        );
        const stat = await fs.lstat(path.join(root, location));
        expect(stat.isSymbolicLink()).toBe(true);
      });
    },
  );

  it("preserves a non-checkout directory", async () => {
    await withProject(async (root) => {
      await fs.mkdir(path.join(root, "repos/effect"), { recursive: true });
      await fs.writeFile(path.join(root, "repos/effect/marker"), "keep");
      await checkFailure(
        root,
        ["scripts/setup-effect-reference.mjs"],
        "standalone Git checkout",
      );
      expect(
        await fs.readFile(path.join(root, "repos/effect/marker"), "utf8"),
      ).toBe("keep");
    });
  });

  it("cleans staging after a failed clone", async () => {
    await withProject(async (root) => {
      await writeJson(root, "scripts/effect-reference.json", {
        ...reference,
        repository: path.join(root, "missing-repository"),
      });
      await checkFailure(
        root,
        ["scripts/setup-effect-reference.mjs"],
        "does not exist",
      );
      expect(await fs.readdir(path.join(root, "repos"))).toEqual([]);
    });
  });

  it("cleans staging after a clone fails pin verification", async () => {
    await withProject(async (root) => {
      const repository = await makeRepository(root);
      await writeJson(root, "scripts/effect-reference.json", {
        ...reference,
        commit: "a".repeat(40),
        repository,
      });
      await checkFailure(
        root,
        ["scripts/setup-effect-reference.mjs"],
        "commit differs",
      );
      expect(await fs.readdir(path.join(root, "repos"))).toEqual([]);
    });
  });

  it("reports malformed source manifests and cleans staging", async () => {
    await withProject(async (root) => {
      await makeRepository(root, { name: "effect", version: 4 });
      await checkFailure(
        root,
        ["scripts/setup-effect-reference.mjs"],
        "verify reference package: invalid JSON data",
      );
      expect(await fs.readdir(path.join(root, "repos"))).toEqual([]);
    });
  });
});
