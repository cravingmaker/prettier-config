import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Effect } from "effect";
import { ESLint } from "eslint";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { runCommand } from "./helpers/node-command.js";

const directory = fileURLToPath(new URL("..", import.meta.url));
const eslint = new ESLint({ cwd: directory });
const parseProject = (filename: string) => {
  const parsed = ts.getParsedCommandLineOfConfigFile(
    filename,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic(diagnostic) {
        throw new Error(
          ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
        );
      },
    },
  );
  if (!parsed) throw new Error(`Could not parse ${filename}`);
  return parsed;
};

describe("repository tooling guards", () => {
  it.each([
    'import { make } from "effect/process/ChildProcess"; void make;',
    'export { make } from "effect/process/ChildProcess";',
    'export * from "effect/process/ChildProcess";',
    'await import("effect/process/ChildProcess");',
    'await import("effect/net/NetAddress");',
    'import { NetAddress } from "effect/net"; void NetAddress;',
    'const processApi = require("effect/process/ChildProcess"); void processApi;',
    'const S = require("effect/Schema"); void S.MacAddress;',
    'const { MacAddress } = require("effect/Schema"); void MacAddress;',
    'import { createRequire } from "node:module"; const load = createRequire(import.meta.url); load("effect/process/ChildProcess");',
    'import { Schema as S } from "effect"; void S.MacAddress;',
    'import { MacAddress as M } from "effect/Schema"; void M;',
    'import * as S from "effect/Schema"; void S.MacAddress;',
    'import * as S from "effect/Schema"; void S["MacAddress"];',
    'import { Schema } from "effect"; const alias = Schema; void alias.MacAddress;',
    'import { Schema } from "effect"; const { MacAddress } = Schema; void MacAddress;',
    'export { MacAddress as M } from "effect/Schema";',
    'export * from "effect/Schema";',
    'import type { API } from "@effect/vitest"; type Test = API;',
    'const target = "effect/Schema"; await import(target);',
    'import { Schema } from "effect"; const key = "String"; void Schema[key];',
    'import { Schema } from "../repos/effect/packages/effect/src/index.ts"; void Schema;',
    'await import("../repos/effect/packages/effect/src/Schema.ts");',
  ])(
    "rejects unsupported Effect access: %s",
    async (source) => {
      const [result] = await eslint.lintText(source, {
        filePath: "tests/helpers/package-smoke.ts",
      });
      expect(result?.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ ruleId: "local/effect-stability" }),
        ]),
      );
    },
    15_000,
  );

  it.each([
    'import { Effect, Schema } from "effect"; void Effect.succeed; void Schema.String;',
    'import * as S from "effect/Schema"; void S["String"];',
    'import { String as S } from "effect/Schema"; void S;',
    'import { it, layer } from "@effect/vitest"; void it.live; void it.effect; void layer;',
    'await import("effect/Schema");',
    'import { Schema } from "effect"; const record = Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.String))({ one: "value" }); const key = "one"; void record[key];',
  ])("permits stable Effect APIs: %s", async (source) => {
    const [result] = await eslint.lintText(source, {
      filePath: "tests/helpers/package-smoke.ts",
    });
    expect(
      result?.messages.filter(
        (message) => message.ruleId === "local/effect-stability",
      ),
    ).toEqual([]);
  });

  it("excludes raw fixtures and reference checkouts from tooling", async () => {
    expect(await eslint.isPathIgnored("repos/effect/example.ts")).toBe(true);
    expect(await eslint.isPathIgnored("tests/fixtures/example.js")).toBe(true);
    const parsed = parseProject(path.join(directory, "tsconfig.json"));
    expect(
      parsed.fileNames.some(
        (filename) =>
          filename.includes("/repos/") || filename.includes("/tests/fixtures/"),
      ),
    ).toBe(false);
  });

  it("rejects an unobserved Effect through the configured language service", async () => {
    const workspace = await fs.mkdtemp(
      path.join(os.tmpdir(), "prettier-effect-diagnostic-"),
    );
    try {
      await fs.copyFile(
        path.join(directory, "tsconfig.json"),
        path.join(workspace, "tsconfig.json"),
      );
      await fs.symlink(
        path.join(directory, "node_modules"),
        path.join(workspace, "node_modules"),
        "junction",
      );
      await fs.mkdir(path.join(workspace, "tests"));
      await fs.writeFile(
        path.join(workspace, "tests", "floating.ts"),
        'import { Effect } from "effect";\nEffect.succeed("unobserved");\n',
      );
      const error = await Effect.runPromise(
        runCommand({
          args: [
            path.join(
              directory,
              "node_modules/@effect/language-service/cli.js",
            ),
            "diagnostics",
            "--project",
            path.join(workspace, "tsconfig.json"),
          ],
          cwd: workspace,
          executable: process.execPath,
          phase: "negative Effect diagnostic",
          timeoutMs: 30_000,
        }).pipe(Effect.flip),
      );
      expect(error).toMatchObject({ exitCode: 1, _tag: "CommandFailure" });
      expect(
        error._tag === "CommandFailure" ? error.stdout : undefined,
      ).toContain("floatingEffect");
    } finally {
      await fs.rm(workspace, { force: true, recursive: true });
    }
  }, 40_000);

  it.each([
    "index.mjs",
    "eslint.config.js",
    "scripts/setup-effect-reference.mjs",
    "tests/consumers/helpers.mjs",
  ])(
    "rejects floating promises and unsafe parsed data in %s",
    async (filePath) => {
      const results = await eslint.lintText(
        'import fs from "node:fs/promises";\nfs.readFile("package.json");\nconst manifest = JSON.parse("{}");\nmanifest.version();\n',
        { filePath },
      );
      const identifiers = results.flatMap((result) =>
        result.messages.map((message) => message.ruleId),
      );
      expect(identifiers).toContain("@typescript-eslint/no-floating-promises");
      expect(identifiers).toContain(
        "@typescript-eslint/no-unsafe-member-access",
      );
      expect(identifiers).toContain("@typescript-eslint/no-unsafe-call");
    },
  );

  it("includes newly added scripts in typechecking", async () => {
    const workspace = await fs.mkdtemp(
      path.join(os.tmpdir(), "prettier-typing-"),
    );
    try {
      await fs.copyFile(
        path.join(directory, "tsconfig.json"),
        path.join(workspace, "tsconfig.json"),
      );
      await fs.symlink(
        path.join(directory, "node_modules"),
        path.join(workspace, "node_modules"),
        "junction",
      );
      await fs.mkdir(path.join(workspace, "scripts"));
      const script = path.join(workspace, "scripts", "new-script.mjs");
      await fs.writeFile(script, "const value = 1; value.toUpperCase();\n");
      const parsed = parseProject(path.join(workspace, "tsconfig.json"));
      expect(parsed.fileNames).toContain(script);
      const diagnostics = ts.getPreEmitDiagnostics(
        ts.createProgram(parsed.fileNames, parsed.options),
      );
      expect(diagnostics).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 2339 })]),
      );
    } finally {
      await fs.rm(workspace, { force: true, recursive: true });
    }
  });

  it("checks required public properties against the actual runtime", async () => {
    const filename = path.join(directory, "index.mjs");
    const source = await fs.readFile(filename, "utf8");
    const { options } = parseProject(path.join(directory, "tsconfig.json"));
    expect(
      ts.resolveModuleName("./index.d.ts", filename, options, ts.sys)
        .resolvedModule?.resolvedFileName,
    ).toBe(path.join(directory, "index.d.ts"));
    const host = ts.createCompilerHost(options);
    const program = ts.createProgram([filename], options, {
      ...host,
      getSourceFile: (
        requested,
        languageVersion,
        onError,
        shouldCreateNewSourceFile,
      ) =>
        requested === filename
          ? ts.createSourceFile(
              requested,
              source.replace("  plugins,\n", ""),
              languageVersion,
              true,
              ts.ScriptKind.JS,
            )
          : host.getSourceFile(
              requested,
              languageVersion,
              onError,
              shouldCreateNewSourceFile,
            ),
    });
    const diagnostics = ts
      .getPreEmitDiagnostics(program)
      .filter((diagnostic) => diagnostic.file?.fileName === filename);
    expect(
      diagnostics.some((diagnostic) =>
        ts
          .flattenDiagnosticMessageText(diagnostic.messageText, "\n")
          .includes("plugins"),
      ),
    ).toBe(true);
  });
});
