import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import prettier from "prettier";
import { afterAll, describe, expect, it } from "vitest";

const fixturesDirectory = path.join(__dirname, "fixtures");
const runtimeConfig = path.resolve(__dirname, "..", "index.mjs");
const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "prettier-config-format-"));
const configPath = path.join(temporaryDirectory, "prettier.config.mjs");

// The files that keep each paragraph on one line.
const markdownExtensions = new Set([".markdown", ".md", ".mdx"]);

const prepareFixture = async (filename: string, fixtureFilename = filename) => {
  const sourcePath = path.join(fixturesDirectory, fixtureFilename);
  const filePath = path.join(temporaryDirectory, filename);
  const content = await fs.readFile(sourcePath, "utf8");

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");

  return filePath;
};

const testFixture = async (filename: string) => {
  const filePath = await prepareFixture(filename);
  const content = await fs.readFile(filePath, "utf8");

  const resolvedConfig = await prettier.resolveConfig(filePath, {
    config: configPath,
    editorconfig: false,
  });

  expect(resolvedConfig).not.toBeNull();

  const options = { ...resolvedConfig, filepath: filePath };
  const formatted = await prettier.format(content, options);
  const isMarkdown = markdownExtensions.has(path.extname(filePath));

  expect(formatted).toBe(
    await prettier.format(content, {
      filepath: filePath,
      ...(typeof resolvedConfig?.parser !== "undefined" && {
        parser: resolvedConfig.parser,
      }),
      plugins: resolvedConfig?.plugins ?? [],
      printWidth: 150,
      ...(isMarkdown && { proseWrap: "never" as const }),
      singleAttributePerLine: true,
    }),
  );
  expect(formatted).toMatchSnapshot();
  expect(await prettier.format(formatted, options)).toBe(formatted);

  return formatted;
};

await fs.writeFile(configPath, `export { default } from ${JSON.stringify(pathToFileURL(runtimeConfig).href)};\n`, "utf8");

// eslint-disable-next-line max-lines-per-function -- This callback registers independent formatter cases.
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
    { filename: "tailwind.vue", parser: "vue" },
    { filename: "tailwind.css", parser: "css" },
    { filename: "tailwind.scss", parser: "scss" },
    { filename: "tailwind.less", parser: "less" },
  ])("infers the $parser parser from nested/$filename", async ({ filename, parser }) => {
    const filePath = await prepareFixture(`nested/${filename}`, filename);
    const resolved = await prettier.resolveConfig(filePath, {
      config: configPath,
      editorconfig: false,
    });

    expect(resolved).not.toBeNull();
    expect(await prettier.getFileInfo(filePath, { plugins: resolved?.plugins })).toMatchObject({
      inferredParser: parser,
    });
  });

  it("01. formats TypeScript correctly", async () => {
    await testFixture("sample.ts");
  });

  it("02. formats JavaScript correctly", async () => {
    await testFixture("sample.js");
  });

  it.each([
    { filename: "width.js", parser: "oxc" },
    { filename: "width.ts", parser: "oxc-ts" },
  ])("wraps at 150 columns with $parser", async ({ filename, parser }) => {
    const filePath = await prepareFixture(`nested/${filename}`, "width.js");
    const source = await fs.readFile(filePath, "utf8");
    const resolved = await prettier.resolveConfig(filePath, {
      config: configPath,
      editorconfig: false,
    });
    const options = { ...resolved, filepath: filePath };
    const formatted = await prettier.format(source, options);

    expect(resolved?.parser).toBe(parser);
    expect(formatted).toBe(
      [
        'const message = createMessage("Hello from the shared Prettier config", "This call fits within 150 columns across multiple consumer projects");',
        "const detailedMessage = createMessage(",
        '  "Hello from the shared Prettier config",',
        '  "This longer call should wrap because it exceeds the shared 150-column width across consumer projects",',
        ");",
        "",
      ].join("\n"),
    );
    expect(resolved?.printWidth).toBe(150);
    expect(await prettier.format(formatted, options)).toBe(formatted);
  });

  it("03. formats TSX correctly", async () => {
    await testFixture("sample.tsx");
  });

  it("04. formats JSX correctly", async () => {
    await testFixture("sample.jsx");
  });

  it("05. formats Astro correctly", async () => {
    await testFixture("sample.astro");
  });

  it("06. formats Svelte correctly", async () => {
    await testFixture("sample.svelte");
  });

  it("07. formats HTML correctly", async () => {
    await testFixture("sample.html");
  });

  it("08. formats CSS correctly", async () => {
    await testFixture("sample.css");
  });

  it.each([
    { filename: "tailwind-functions.js", parser: "oxc" },
    { filename: "tailwind-functions.ts", parser: "oxc-ts" },
  ])("sorts Tailwind helper functions with $parser", async ({ filename, parser }) => {
    const filePath = await prepareFixture(`nested/${filename}`, "tailwind-functions.js");
    const source = await fs.readFile(filePath, "utf8");
    const resolved = await prettier.resolveConfig(filePath, {
      config: configPath,
      editorconfig: false,
    });
    const options = { ...resolved, filepath: filePath };
    const formatted = await prettier.format(source, options);

    expect(resolved?.parser).toBe(parser);
    expect(formatted).toContain('clsx("flex p-4 text-white")');
    expect(formatted).toContain('cn("flex p-4 text-white")');
    expect(formatted).toContain('cva("flex p-4 text-white",');
    expect(formatted).toContain('classNames("flex p-4 text-white")');
    expect(formatted).toContain('classnames("flex p-4 text-white")');
    expect(formatted).toContain('base: "flex p-4 text-white"');
    expect(formatted).toContain('small: "px-4 py-2"');
    expect(formatted).toContain('"bg-blue-500 font-bold": active');
    expect(formatted).toContain("cn`flex p-4 text-white`");
    expect(formatted).toContain('custom("text-white p-4 flex")');
    expect(await prettier.format(formatted, options)).toBe(formatted);
  });

  it("sorts Tailwind classes in Vue attributes, bindings, and scoped styles", async () => {
    const formatted = await testFixture("tailwind.vue");

    expect(formatted).toContain('class="custom-button flex rounded bg-blue-500 p-4 font-semibold text-white hover:bg-blue-700"');
    expect(formatted).toContain("'px-6 py-3 text-lg font-bold'");
    expect(formatted).toContain("'px-4 py-2 text-sm font-normal'");
    expect(formatted).toContain(`v-bind:class="['flex justify-center', { 'bg-black text-white': active }]"`);
    expect(formatted).toContain('data-label="text-white bg-black"');
    expect(formatted).toContain("@apply flex rounded bg-blue-500 p-4 text-white;");
  });

  it.each([
    { declaration: "color: var(--accent);", filename: "tailwind.css" },
    { declaration: "color: $accent;", filename: "tailwind.scss" },
    { declaration: "color: @accent;", filename: "tailwind.less" },
  ])("sorts Tailwind @apply utilities while preserving stylesheet syntax in $filename", async ({ declaration, filename }) => {
    const formatted = await testFixture(filename);

    expect(formatted).toContain("@apply flex items-center rounded bg-blue-500 p-4 text-white hover:bg-blue-700;");
    expect(formatted).toContain("@apply flex items-center px-4 py-2 !important;");
    expect(formatted).toContain(declaration);
    expect(formatted).toContain("/* Keep component styles */");
  });

  it("09. formats Markdown correctly", async () => {
    await testFixture("sample.md");
  });

  it("10. formats package.json correctly", async () => {
    await testFixture("package.json");
  });

  it("11. formats JSON with Prettier defaults", async () => {
    await testFixture("sample.json");
  });

  it("12. formats JSONC with Prettier defaults", async () => {
    await testFixture("sample.jsonc");
  });

  it("13. formats JSON5 with Prettier defaults", async () => {
    await testFixture("sample.json5");
  });

  it("14. formats YAML with Prettier defaults", async () => {
    await testFixture("sample.yaml");
  });

  it("15. formats YML with Prettier defaults", async () => {
    await testFixture("sample.yml");
  });

  it("16. formats MDX with Prettier defaults", async () => {
    await testFixture("sample.mdx");
  });

  it("17. formats TOML correctly", async () => {
    await testFixture("sample.toml");
  });

  it("preserves TOML key order, comments, and multiline string contents", async () => {
    const formatted = await testFixture("complex.toml");

    expect(formatted.indexOf("zulu =")).toBeLessThan(formatted.indexOf("alpha ="));
    expect(formatted).toContain("# Keep the deployment order");
    expect(formatted).toContain("# Primary target");
    expect(formatted).toContain('message = """\nFirst line\n  Indented second line\nLast line\n"""');
    expect(formatted).toContain("literal = '''\nC:\\work\\project\n  Keep these spaces\n'''");
    expect(formatted).toContain(
      'targets = ["production-region-primary", "production-region-secondary", "development-region-primary", "development-region-secondary"]',
    );
  });

  it("uses Svelte shorthand only when the attribute matches its expression", async () => {
    const formatted = await testFixture("shorthand.svelte");

    expect(formatted).toContain("{title}");
    expect(formatted).not.toContain("title={title}");
    expect(formatted).toContain("disabled={enabled}");
  });

  it.each(["embedded.md", "embedded.mdx"])("inherits the shared width and JavaScript quotes inside %s", async (filename) => {
    const formatted = await testFixture(filename);

    expect(formatted).toContain('const options = { first: "one", second: "two", third: "three", fourth: "four", fifth: "five", sixth: "six" };');
  });

  it.each(["prose.md", "prose.mdx"])("keeps each paragraph, list item, and quotation of %s on one line", async (filename) => {
    const formatted = await testFixture(filename);

    expect(formatted).toContain("\nA paragraph that was wrapped by hand across three lines.\n");
    expect(formatted).toContain("\n- A list item that continues on a second line.\n");
    expect(formatted).toContain("\n> A quotation that continues on a second line.\n");
    // A GitHub alert needs its marker on a line of its own, which the empty quoted line keeps.
    expect(formatted).toContain("\n> [!NOTE]\n>\n> An alert keeps its marker on a line of its own.\n");
    expect(formatted).toContain("\nA hard line break\\\nstays.\n");
  });

  it("keeps the line breaks of a multi-line YAML value", async () => {
    await expect(testFixture("multiline.yml")).resolves.toBe("condition: first == 'one' &&\n  second == 'two'\n");
  });

  it.each(["quotes.yaml", "quotes.yml"])("uses double quotes for quoted YAML values in %s", async (filename) => {
    const formatted = await testFixture(filename);

    expect(formatted).toContain('message: "status: ready"');
    expect(formatted).toContain('boolean_text: "true"');
  });

  it("uses default TOML quotes while preserving literal backslashes", async () => {
    const formatted = await testFixture("quotes.toml");

    expect(formatted).toContain('"quoted key" = "hello"');
    expect(formatted).toContain(String.raw`path = 'C:\work\project'`);
  });

  it("formats XML structure, attributes, namespaces, and comments", async () => {
    const formatted = await testFixture("sample.xml");

    expect(formatted).toContain("<app:item");
    expect(formatted).toContain("title='say \"hello\"'");
    expect(formatted).toContain("xmlns:app='urn:example'");
    expect(formatted.indexOf("z='last'")).toBeLessThan(formatted.indexOf("a='first'"));
    // eslint-disable-next-line unicorn/string-content -- XML comment delimiters must remain literal
    expect(formatted).toContain("<!-- keep this comment -->");
    expect(formatted).toContain("<empty />");
  });

  it("preserves XML mixed text, entities, CDATA, and explicit whitespace", async () => {
    const formatted = await testFixture("mixed.xml");

    expect(formatted).toContain("<p>Hello <b>world</b> ! &amp; goodbye.</p>");
    expect(formatted).toContain("xml:space='preserve'");
    expect(formatted).toContain(">  keep  this\n  text </raw>");
    expect(formatted).toContain('<![CDATA[if (a < b) { value = "x & y"; }]]>');
  });

  it("uses the 150-column print width for XML in nested directories", async () => {
    const filePath = await prepareFixture("nested/width.xml", "width.xml");
    const source = await fs.readFile(filePath, "utf8");
    const resolved = await prettier.resolveConfig(filePath, {
      config: configPath,
      editorconfig: false,
    });
    const options = { ...resolved, filepath: filePath };
    const formatted = await prettier.format(source, options);

    expect(resolved?.printWidth).toBe(150);
    expect(formatted.trim()).not.toContain("\n");
    expect(formatted).toBe(await prettier.format(source, { ...options, printWidth: 150 }));
    expect(formatted).not.toBe(await prettier.format(source, { ...options, printWidth: 80 }));
    expect(await prettier.format(formatted, options)).toBe(formatted);
  });

  it("reports incomplete XML markup", async () => {
    const filePath = await prepareFixture("sample.xml");
    const resolved = await prettier.resolveConfig(filePath, {
      config: configPath,
      editorconfig: false,
    });

    await expect(prettier.format("<root", { ...resolved, filepath: filePath })).rejects.toThrow();
  });

  it.each(["package.json", "package-lock.json", "nested/package.json", "nested/package-lock.json"])(
    "uses Prettier defaults while preserving package formatting for %s",
    async (filename) => {
      const filePath = await prepareFixture(filename, `width/${path.basename(filename)}`);
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

      // Package files infer json-stringify and retain package-key sorting.
      expect(await prettier.getFileInfo(filePath)).toMatchObject({
        inferredParser: "json-stringify",
      });
      expect(formatted).toMatchSnapshot();
      expect(formatted).toBe(defaults);
      expect(JSON.parse(formatted)).toEqual(JSON.parse(source));
      expect(await prettier.format(formatted, options)).toBe(formatted);
    },
  );
});
