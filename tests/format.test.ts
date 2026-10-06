import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import prettier from "prettier";
import { afterAll, describe, expect, it } from "vitest";

const fixturesDirectory = path.join(__dirname, "fixtures");
const runtimeConfig = path.resolve(__dirname, "..", "index.mjs");
const temporaryDirectory = await fs.mkdtemp(
  path.join(os.tmpdir(), "prettier-config-format-"),
);
const configPath = path.join(temporaryDirectory, "prettier.config.mjs");

const prepareFixture = async (
  filename: string,
  directory: string,
  fixtureFilename = filename,
) => {
  const sourcePath = path.join(fixturesDirectory, fixtureFilename);
  const filePath = path.join(directory, filename);
  const content = await fs.readFile(sourcePath, "utf8");

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");

  return filePath;
};

const testFixture = async (
  filename: string,
  directory: string,
  prettierConfigPath: string,
) => {
  const filePath = await prepareFixture(filename, directory);
  const content = await fs.readFile(filePath, "utf8");

  const resolvedConfig = await prettier.resolveConfig(filePath, {
    config: prettierConfigPath,
    editorconfig: false,
  });

  expect(resolvedConfig).not.toBeNull();

  const options = { ...resolvedConfig, filepath: filePath };
  const formatted = await prettier.format(content, options);

  expect(formatted).toBe(
    await prettier.format(content, {
      filepath: filePath,
      ...(resolvedConfig?.parser === undefined
        ? {}
        : { parser: resolvedConfig.parser }),
      plugins: resolvedConfig?.plugins ?? [],
      singleAttributePerLine: true,
    }),
  );
  expect(formatted).toMatchSnapshot();
  expect(await prettier.format(formatted, options)).toBe(formatted);

  return formatted;
};

await fs.writeFile(
  configPath,
  `export { default } from ${JSON.stringify(pathToFileURL(runtimeConfig).href)};\n`,
  "utf8",
);

describe("Format Integration", () => {
  afterAll(async () => {
    await fs.rm(temporaryDirectory, {
      force: true,
      recursive: true,
    });
  });

  it.each([
    { filename: "sample.ts", parser: "oxc-ts" },
    { filename: "sample.cts", parser: "oxc-ts" },
    { filename: "sample.mts", parser: "oxc-ts" },
    { filename: "sample.tsx", parser: "oxc-ts" },
    { filename: "sample.js", parser: "oxc" },
    { filename: "sample.cjs", parser: "oxc" },
    { filename: "sample.mjs", parser: "oxc" },
    { filename: "sample.jsx", parser: "oxc" },
  ])("selects $parser for nested/$filename", async ({ filename, parser }) => {
    const filePath = path.join(temporaryDirectory, "nested", filename);
    const resolved = await prettier.resolveConfig(filePath, {
      config: configPath,
      editorconfig: false,
    });

    expect(resolved?.parser).toBe(parser);
  });

  it.each([
    { filename: "sample.astro", parser: "astro" },
    { filename: "sample.svelte", parser: "svelte" },
    { filename: "sample.toml", parser: "toml" },
    { filename: "sample.xml", parser: "xml" },
  ])(
    "infers the $parser parser from nested/$filename",
    async ({ filename, parser }) => {
      const filePath = await prepareFixture(
        `nested/${filename}`,
        temporaryDirectory,
        filename,
      );
      const resolved = await prettier.resolveConfig(filePath, {
        config: configPath,
        editorconfig: false,
      });

      expect(resolved).not.toBeNull();
      expect(
        await prettier.getFileInfo(filePath, { plugins: resolved?.plugins }),
      ).toMatchObject({
        inferredParser: parser,
      });
    },
  );

  it("01. formats TypeScript correctly", async () => {
    await testFixture("sample.ts", temporaryDirectory, configPath);
  });

  it("02. formats JavaScript correctly", async () => {
    await testFixture("sample.js", temporaryDirectory, configPath);
  });

  it("03. formats TSX correctly", async () => {
    await testFixture("sample.tsx", temporaryDirectory, configPath);
  });

  it("04. formats JSX correctly", async () => {
    await testFixture("sample.jsx", temporaryDirectory, configPath);
  });

  it("05. formats Astro correctly", async () => {
    await testFixture("sample.astro", temporaryDirectory, configPath);
  });

  it("06. formats Svelte correctly", async () => {
    await testFixture("sample.svelte", temporaryDirectory, configPath);
  });

  it("07. formats HTML correctly", async () => {
    await testFixture("sample.html", temporaryDirectory, configPath);
  });

  it("08. formats CSS correctly", async () => {
    await testFixture("sample.css", temporaryDirectory, configPath);
  });

  it("09. formats Markdown correctly", async () => {
    await testFixture("sample.md", temporaryDirectory, configPath);
  });

  it("10. formats package.json correctly", async () => {
    await testFixture("package.json", temporaryDirectory, configPath);
  });

  it("11. formats JSON with Prettier defaults", async () => {
    await testFixture("sample.json", temporaryDirectory, configPath);
  });

  it("12. formats JSONC with Prettier defaults", async () => {
    await testFixture("sample.jsonc", temporaryDirectory, configPath);
  });

  it("13. formats JSON5 with Prettier defaults", async () => {
    await testFixture("sample.json5", temporaryDirectory, configPath);
  });

  it("14. formats YAML with Prettier defaults", async () => {
    await testFixture("sample.yaml", temporaryDirectory, configPath);
  });

  it("15. formats YML with Prettier defaults", async () => {
    await testFixture("sample.yml", temporaryDirectory, configPath);
  });

  it("16. formats MDX with Prettier defaults", async () => {
    await testFixture("sample.mdx", temporaryDirectory, configPath);
  });

  it("17. formats TOML correctly", async () => {
    await testFixture("sample.toml", temporaryDirectory, configPath);
  });

  it("preserves TOML key order, comments, and multiline string contents", async () => {
    const formatted = await testFixture(
      "complex.toml",
      temporaryDirectory,
      configPath,
    );

    expect(formatted.indexOf("zulu =")).toBeLessThan(
      formatted.indexOf("alpha ="),
    );
    expect(formatted).toContain("# Keep the deployment order");
    expect(formatted).toContain("# Primary target");
    expect(formatted).toContain(
      'message = """\nFirst line\n  Indented second line\nLast line\n"""',
    );
    expect(formatted).toContain(
      "literal = '''\nC:\\work\\project\n  Keep these spaces\n'''",
    );
    expect(formatted).toContain('targets = [\n  "production-region-primary",');
  });

  it("uses Svelte shorthand only when the attribute matches its expression", async () => {
    const formatted = await testFixture(
      "shorthand.svelte",
      temporaryDirectory,
      configPath,
    );

    expect(formatted).toContain("{title}");
    expect(formatted).not.toContain("title={title}");
    expect(formatted).toContain("disabled={enabled}");
  });

  it.each(["embedded.md", "embedded.mdx"])(
    "inherits JavaScript quotes and trailing commas inside %s",
    async (filename) => {
      const formatted = await testFixture(
        filename,
        temporaryDirectory,
        configPath,
      );

      expect(formatted).toContain('  first: "one",\n');
      expect(formatted).toContain('  sixth: "six",\n};');
    },
  );

  it.each(["quotes.yaml", "quotes.yml"])(
    "uses double quotes for quoted YAML values in %s",
    async (filename) => {
      const formatted = await testFixture(
        filename,
        temporaryDirectory,
        configPath,
      );

      expect(formatted).toContain('message: "status: ready"');
      expect(formatted).toContain('boolean_text: "true"');
    },
  );

  it("uses default TOML quotes while preserving literal backslashes", async () => {
    const formatted = await testFixture(
      "quotes.toml",
      temporaryDirectory,
      configPath,
    );

    expect(formatted).toContain('"quoted key" = "hello"');
    expect(formatted).toContain(String.raw`path = 'C:\work\project'`);
  });

  it("formats XML structure, attributes, namespaces, and comments", async () => {
    const formatted = await testFixture(
      "sample.xml",
      temporaryDirectory,
      configPath,
    );

    expect(formatted).toContain("<app:item");
    expect(formatted).toContain("title='say \"hello\"'");
    expect(formatted).toContain("xmlns:app='urn:example'");
    expect(formatted.indexOf("z='last'")).toBeLessThan(
      formatted.indexOf("a='first'"),
    );
    // eslint-disable-next-line unicorn/string-content -- XML comment delimiters must remain literal
    expect(formatted).toContain("<!-- keep this comment -->");
    expect(formatted).toContain("<empty />");
  });

  it("preserves XML mixed text, entities, CDATA, and explicit whitespace", async () => {
    const formatted = await testFixture(
      "mixed.xml",
      temporaryDirectory,
      configPath,
    );

    expect(formatted).toContain("<p>Hello <b>world</b> ! &amp; goodbye.</p>");
    expect(formatted).toContain("xml:space='preserve'");
    expect(formatted).toContain(">  keep  this\n  text </raw>");
    expect(formatted).toContain('<![CDATA[if (a < b) { value = "x & y"; }]]>');
  });

  it("uses the default print width for XML in nested directories", async () => {
    const filePath = await prepareFixture(
      "nested/width.xml",
      temporaryDirectory,
      "width.xml",
    );
    const source = await fs.readFile(filePath, "utf8");
    const resolved = await prettier.resolveConfig(filePath, {
      config: configPath,
      editorconfig: false,
    });
    const options = { ...resolved, filepath: filePath };
    const formatted = await prettier.format(source, options);

    expect(resolved).not.toHaveProperty("printWidth");
    expect(formatted.trim()).toContain("\n");
    expect(formatted).toBe(
      await prettier.format(source, { ...options, printWidth: 80 }),
    );
    expect(formatted).not.toBe(
      await prettier.format(source, { ...options, printWidth: 120 }),
    );
    expect(await prettier.format(formatted, options)).toBe(formatted);
  });

  it("reports incomplete XML markup", async () => {
    const filePath = await prepareFixture("sample.xml", temporaryDirectory);
    const resolved = await prettier.resolveConfig(filePath, {
      config: configPath,
      editorconfig: false,
    });

    await expect(
      prettier.format("<root", { ...resolved, filepath: filePath }),
    ).rejects.toThrow();
  });

  it.each([
    "package.json",
    "package-lock.json",
    "nested/package.json",
    "nested/package-lock.json",
  ])(
    "uses Prettier defaults while preserving package formatting for %s",
    async (filename) => {
      const filePath = await prepareFixture(
        filename,
        temporaryDirectory,
        `width/${path.basename(filename)}`,
      );
      const source = await fs.readFile(filePath, "utf8");
      const resolved = await prettier.resolveConfig(filePath, {
        config: configPath,
        editorconfig: false,
      });
      const options = { ...resolved, filepath: filePath };
      const formatted = await prettier.format(source, options);
      const defaults = await prettier.format(source, {
        filepath: filePath,
        plugins: resolved?.plugins ?? [],
        singleAttributePerLine: true,
      });
      const keywords =
        '["formatting-tools", "configuration", "developer-workflow", "package-metadata"]';

      // Package files infer json-stringify and retain package-key sorting.
      expect(await prettier.getFileInfo(filePath)).toMatchObject({
        inferredParser: "json-stringify",
      });
      expect(formatted).toMatchSnapshot();
      expect(formatted).toBe(defaults);

      // The same fixture distinguishes 80 from 100 with the regular JSON parser.
      const jsonWide = await prettier.format(source, {
        ...options,
        parser: "json",
        printWidth: 100,
      });
      const jsonNarrow = await prettier.format(source, {
        ...options,
        parser: "json",
        printWidth: 80,
      });
      expect(jsonWide).toContain(keywords);
      expect(jsonNarrow).not.toContain(keywords);
      expect(JSON.parse(formatted)).toEqual(JSON.parse(source));
      expect(await prettier.format(formatted, options)).toBe(formatted);
    },
  );
});
