import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import packageJson from "../package.json" with { type: "json" };

const projectDirectory = path.resolve(__dirname, "..");
const consumerNode =
  // eslint-disable-next-line n/no-process-env -- CI selects the consumer runtime independently of the test runner
  process.env.PRETTIER_CONFIG_CONSUMER_NODE ?? process.execPath;

const requiredDependencies = [
  "prettier",
  "prettier-plugin-packagejson",
  "prettier-plugin-toml",
  "@prettier/plugin-oxc",
  "@prettier/plugin-xml",
] as const;

const optionalDependencies = [
  `prettier-plugin-astro@${packageJson.devDependencies["prettier-plugin-astro"]}`,
  `prettier-plugin-svelte@${packageJson.devDependencies["prettier-plugin-svelte"]}`,
  `prettier-plugin-tailwindcss@${packageJson.devDependencies["prettier-plugin-tailwindcss"]}`,
  `svelte@${packageJson.devDependencies.svelte}`,
] as const;

const runConsumer = async (
  consumerDirectory: string,
  script: "base.mjs" | "optional.mjs",
  externalCwd: boolean,
) => {
  await Promise.all(
    [script, "helpers.mjs"].map(async (filename) => {
      await fs.copyFile(
        path.join(projectDirectory, "tests", "consumers", filename),
        path.join(consumerDirectory, filename),
      );
    }),
  );

  return execFileSync(consumerNode, [path.join(consumerDirectory, script)], {
    cwd: externalCwd ? path.dirname(consumerDirectory) : consumerDirectory,
    encoding: "utf8",
    timeout: 30_000,
  });
};

const linkDependency = async (
  nodeModulesDirectory: string,
  dependency: string,
) => {
  const source = path.join(projectDirectory, "node_modules", dependency);
  const destination = path.join(nodeModulesDirectory, dependency);

  await fs.mkdir(path.dirname(destination), {
    recursive: true,
  });

  await fs.symlink(source, destination, "junction");
};

const createPackedPackage = async () => {
  const temporaryDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "prettier-config-package-"),
  );

  execFileSync(
    "npm",
    ["pack", "--ignore-scripts", "--pack-destination", temporaryDirectory],
    {
      cwd: projectDirectory,
      encoding: "utf8",
    },
  );

  const packedFiles = await fs.readdir(temporaryDirectory);
  const tarballs = packedFiles.filter((file) => file.endsWith(".tgz"));
  const [tarballFilename] = tarballs;

  if (tarballs.length !== 1 || tarballFilename === undefined) {
    throw new Error(
      `Expected exactly one packed tarball, found ${tarballs.length}`,
    );
  }

  return {
    tarball: path.join(temporaryDirectory, tarballFilename),
    temporaryDirectory,
  };
};

const { tarball, temporaryDirectory } = await createPackedPackage();

const createConsumer = async (
  name: string,
  dependencies: readonly string[],
) => {
  const consumerDirectory = path.join(temporaryDirectory, name);
  const nodeModulesDirectory = path.join(consumerDirectory, "node_modules");
  const packageDirectory = path.join(
    nodeModulesDirectory,
    "@cravingmaker",
    "prettier-config",
  );

  await fs.mkdir(packageDirectory, {
    recursive: true,
  });

  execFileSync(
    "tar",
    ["-xzf", tarball, "--strip-components=1", "-C", packageDirectory],
    {
      cwd: temporaryDirectory,
    },
  );

  await Promise.all(
    dependencies.map(async (dependency) => {
      await linkDependency(nodeModulesDirectory, dependency);
    }),
  );

  await fs.writeFile(
    path.join(consumerDirectory, "package.json"),
    JSON.stringify({
      name: `prettier-config-${name}`,
      prettier: "@cravingmaker/prettier-config",
      private: true,
      type: "module",
    }),
    "utf8",
  );

  return consumerDirectory;
};

const installConsumer = async (
  consumerDirectory: string,
  dependencies: readonly string[],
) => {
  await fs.mkdir(consumerDirectory);
  await fs.writeFile(
    path.join(consumerDirectory, "package.json"),
    JSON.stringify({
      name: path.basename(consumerDirectory),
      prettier: packageJson.name,
      private: true,
      type: "module",
    }),
    "utf8",
  );

  // Only install the tarball and consumer tools; runtime dependencies must come from package metadata.
  execFileSync(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--save-exact",
      tarball,
      `prettier@${packageJson.devDependencies.prettier}`,
      ...dependencies,
    ],
    { cwd: consumerDirectory, encoding: "utf8", timeout: 120_000 },
  );
};

describe("Published Package", () => {
  afterAll(async () => {
    await fs.rm(temporaryDirectory, {
      force: true,
      recursive: true,
    });
  });

  it("ships the runtime and public types without build artifacts", () => {
    const entries = execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" })
      .trim()
      .split("\n");

    expect(entries).toHaveLength(5);
    expect(entries).toEqual(
      expect.arrayContaining([
        "package/LICENSE",
        "package/README.md",
        "package/index.d.ts",
        "package/index.mjs",
        "package/package.json",
      ]),
    );
  });

  it("installs the tarball and consumes its runtime and public types", async () => {
    const consumerDirectory = path.join(
      temporaryDirectory,
      "installed-consumer",
    );
    await installConsumer(consumerDirectory, [
      `typescript@${packageJson.devDependencies.typescript}`,
    ]);

    const installedPackage = await fs.lstat(
      path.join(consumerDirectory, "node_modules", packageJson.name),
    );
    expect(installedPackage.isSymbolicLink()).toBe(false);
    await Promise.all(
      ["check.mjs", "typecheck.ts", "tsconfig.json"].map(async (filename) => {
        await fs.copyFile(
          path.join(
            projectDirectory,
            "tests",
            "fixtures",
            "installed-consumer",
            filename,
          ),
          path.join(consumerDirectory, filename),
        );
      }),
    );

    const output = execFileSync(consumerNode, ["check.mjs"], {
      cwd: consumerDirectory,
      encoding: "utf8",
      timeout: 30_000,
    });
    expect(output).toBe("ok");

    // TypeScript is a development tool; only the runtime check uses the minimum consumer Node in CI.
    execFileSync(
      process.execPath,
      ["node_modules/typescript/bin/tsc", "--project", "tsconfig.json"],
      {
        cwd: consumerDirectory,
        encoding: "utf8",
        timeout: 30_000,
      },
    );
  }, 180_000);

  it.each([false, true])(
    "works without optional plugins (external cwd: %s)",
    async (externalCwd) => {
      const consumerDirectory = await createConsumer(
        `base-consumer-${String(externalCwd)}`,
        requiredDependencies,
      );

      const output = await runConsumer(
        consumerDirectory,
        "base.mjs",
        externalCwd,
      );

      expect(output).toBe("ok");
    },
  );

  describe("with npm-installed optional plugins", () => {
    const consumerDirectory = path.join(
      temporaryDirectory,
      "installed-optional-consumer",
    );

    beforeAll(async () => {
      await installConsumer(consumerDirectory, optionalDependencies);

      await Promise.all(
        ["tailwind.vue", "tailwind.css", "tailwind.scss", "tailwind.less"].map(
          async (filename) => {
            await fs.copyFile(
              path.join(projectDirectory, "tests", "fixtures", filename),
              path.join(consumerDirectory, filename),
            );
          },
        ),
      );
    }, 180_000);

    it.each([false, true])(
      "loads optional plugins from the consumer (external cwd: %s)",
      async (externalCwd) => {
        const output = await runConsumer(
          consumerDirectory,
          "optional.mjs",
          externalCwd,
        );

        expect(output).toBe("ok");
      },
    );
  });
});
