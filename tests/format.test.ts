import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import prettier from "prettier";
import { afterAll, describe, expect, it } from "vitest";

const fixturesDirectory = fileURLToPath(new URL("fixtures", import.meta.url));
// Overrides match paths relative to their config file, and the repository ignores its fixtures, so
// the tests format copies of the fixtures beside a config that loads the runtime.
const runtime = new URL("../index.mjs", import.meta.url);
const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "prettier-config-format-"));
const configPath = path.join(temporaryDirectory, "prettier.config.mjs");
await fs.writeFile(configPath, `export { default } from ${JSON.stringify(runtime.href)};\n`);

// Copies a fixture into the temporary project and returns its path there.
const prepareFixture = async (filename: string, fixtureFilename = filename) => {
  const filePath = path.join(temporaryDirectory, filename);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.copyFile(path.join(fixturesDirectory, fixtureFilename), filePath);
  return filePath;
};

const resolveOptions = async (filePath: string) => {
  const resolved = await prettier.resolveConfig(filePath, { config: configPath, editorconfig: false });
  expect(resolved).not.toBeNull();
  return { ...resolved, filepath: filePath };
};

// Formats a fixture with the shared config and checks that formatting the result changes nothing.
const formatFixture = async (filename: string, fixtureFilename = filename) => {
  const filePath = await prepareFixture(filename, fixtureFilename);
  const options = await resolveOptions(filePath);
  const source = await fs.readFile(filePath, "utf8");
  const formatted = await prettier.format(source, options);
  expect(await prettier.format(formatted, options)).toBe(formatted);
  return { formatted, options, source };
};

// Formats a fixture and compares the result with its reviewed snapshot.
const expectSnapshot = async (filename: string) => {
  const { formatted } = await formatFixture(filename);
  expect(formatted).toMatchSnapshot();
  return formatted;
};

describe("formatting with the shared config", () => {
  afterAll(async () => {
    await fs.rm(temporaryDirectory, { force: true, recursive: true });
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
    const options = await resolveOptions(path.join(temporaryDirectory, "nested", filename));

    expect(options.parser).toBe(parser);
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
    const { plugins } = await resolveOptions(filePath);

    expect(await prettier.getFileInfo(filePath, { plugins })).toMatchObject({ inferredParser: parser });
  });

  it.each([
    "sample.ts",
    "sample.js",
    "sample.tsx",
    "sample.jsx",
    "sample.astro",
    "sample.svelte",
    "sample.html",
    "sample.css",
    "sample.md",
    "sample.mdx",
    "package.json",
    "sample.json",
    "sample.jsonc",
    "sample.json5",
    "sample.yaml",
    "sample.yml",
    "sample.toml",
  ])("formats %s", async (filename) => {
    await expectSnapshot(filename);
  });

  it.each([
    { filename: "width.js", parser: "oxc" },
    { filename: "width.ts", parser: "oxc-ts" },
  ])("wraps at 150 columns with $parser", async ({ filename, parser }) => {
    const { formatted, options } = await formatFixture(`nested/${filename}`, "width.js");

    expect(options.parser).toBe(parser);
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
  });

  it.each([
    { filename: "tailwind-functions.js", parser: "oxc" },
    { filename: "tailwind-functions.ts", parser: "oxc-ts" },
  ])("sorts Tailwind helper functions with $parser", async ({ filename, parser }) => {
    const { formatted, options } = await formatFixture(`nested/${filename}`, "tailwind-functions.js");

    expect(options.parser).toBe(parser);
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
  });

  it("sorts Tailwind classes in Vue attributes, bindings, and scoped styles", async () => {
    const formatted = await expectSnapshot("tailwind.vue");

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
    const formatted = await expectSnapshot(filename);

    expect(formatted).toContain("@apply flex items-center rounded bg-blue-500 p-4 text-white hover:bg-blue-700;");
    expect(formatted).toContain("@apply flex items-center px-4 py-2 !important;");
    expect(formatted).toContain(declaration);
    expect(formatted).toContain("/* Keep component styles */");
  });

  it("preserves TOML key order, comments, and multiline string contents", async () => {
    const formatted = await expectSnapshot("complex.toml");

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
    const formatted = await expectSnapshot("shorthand.svelte");

    expect(formatted).toContain("{title}");
    expect(formatted).not.toContain("title={title}");
    expect(formatted).toContain("disabled={enabled}");
  });

  it.each(["embedded.md", "embedded.mdx"])("inherits the shared width and JavaScript quotes inside %s", async (filename) => {
    const formatted = await expectSnapshot(filename);

    expect(formatted).toContain('const options = { first: "one", second: "two", third: "three", fourth: "four", fifth: "five", sixth: "six" };');
  });

  it.each(["prose.md", "prose.mdx"])("keeps each paragraph, list item, and quotation of %s on one line", async (filename) => {
    const formatted = await expectSnapshot(filename);

    expect(formatted).toContain("\nA paragraph that was wrapped by hand across three lines.\n");
    expect(formatted).toContain("\n- A list item that continues on a second line.\n");
    expect(formatted).toContain("\n> A quotation that continues on a second line.\n");
    // A GitHub alert needs its marker on a line of its own, which the empty quoted line keeps.
    expect(formatted).toContain("\n> [!NOTE]\n>\n> An alert keeps its marker on a line of its own.\n");
    expect(formatted).toContain("\nA hard line break\\\nstays.\n");
  });

  it("keeps the line breaks of a multi-line YAML value", async () => {
    expect(await expectSnapshot("multiline.yml")).toBe("condition: first == 'one' &&\n  second == 'two'\n");
  });

  it.each(["quotes.yaml", "quotes.yml"])("uses double quotes for quoted YAML values in %s", async (filename) => {
    const formatted = await expectSnapshot(filename);

    expect(formatted).toContain('message: "status: ready"');
    expect(formatted).toContain('boolean_text: "true"');
  });

  it("uses default TOML quotes while preserving literal backslashes", async () => {
    const formatted = await expectSnapshot("quotes.toml");

    expect(formatted).toContain('"quoted key" = "hello"');
    expect(formatted).toContain(String.raw`path = 'C:\work\project'`);
  });

  it("formats XML structure, attributes, namespaces, and comments", async () => {
    const formatted = await expectSnapshot("sample.xml");

    expect(formatted).toContain("<app:item");
    expect(formatted).toContain("title='say \"hello\"'");
    expect(formatted).toContain("xmlns:app='urn:example'");
    expect(formatted.indexOf("z='last'")).toBeLessThan(formatted.indexOf("a='first'"));
    // eslint-disable-next-line unicorn/string-content -- XML comment delimiters must remain literal
    expect(formatted).toContain("<!-- keep this comment -->");
    expect(formatted).toContain("<empty />");
  });

  it("preserves XML mixed text, entities, CDATA, and explicit whitespace", async () => {
    const formatted = await expectSnapshot("mixed.xml");

    expect(formatted).toContain("<p>Hello <b>world</b> ! &amp; goodbye.</p>");
    expect(formatted).toContain("xml:space='preserve'");
    expect(formatted).toContain(">  keep  this\n  text </raw>");
    expect(formatted).toContain('<![CDATA[if (a < b) { value = "x & y"; }]]>');
  });

  // The npm CLI writes these files with JSON.stringify, whose layout no print width changes.
  it.each(["package.json", "package-lock.json"])("uses Prettier defaults while preserving package formatting for %s", async (filename) => {
    const { formatted, options, source } = await formatFixture(filename, `width/${filename}`);

    expect(await prettier.getFileInfo(options.filepath)).toMatchObject({ inferredParser: "json-stringify" });
    expect(formatted).toMatchSnapshot();
    expect(formatted).toBe(await prettier.format(source, { filepath: options.filepath, plugins: options.plugins ?? [] }));
  });
});
