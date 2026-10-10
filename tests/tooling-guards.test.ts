import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import ts from "typescript";
import { describe, expect, it } from "vitest";

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
