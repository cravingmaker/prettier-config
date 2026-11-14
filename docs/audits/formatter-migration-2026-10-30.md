# Formatter migration audit: Prettier, Oxfmt, and Bun

Audited on October 30, 2026, against repository commit `cec44e82515e4104f06440c7d7d5dd13bf0128c8`.

## Decision

**Neither Oxfmt nor Bun fully replaces this setup with every existing behavior, plugin option, integration, and public API preserved.** Bun 1.4.4 is the stronger candidate for replacing the CLI command while retaining the shared configuration and installed Prettier. Oxfmt 0.75.0 is a viable faster formatter for supported files, with a manually authored configuration and explicit acceptance of differences or routing to Prettier.

For strict output compatibility, keep Prettier as the authority. For a migration pilot, start with Bun in a consuming project, keep the existing config and plugins, and address the Markdown fence and outside-directory cases below. For a project that can change formatting conventions, both native engines are credible candidates, but neither eliminates all fallback dependencies for this package's supported formats.

The package, dependencies, scripts, workflows, snapshots, and published runtime were not migrated during this audit. The deliverables are this report, its [machine-readable evidence](formatter-migration-2026-10-30.evidence.json), and the [timing chart](formatter-timings-2026-10-30.html).

## Versions and method

| Component                        | Audited version                                                |
| -------------------------------- | -------------------------------------------------------------- |
| Shared configuration             | `@cravingmaker/prettier-config` 0.3.2, current checkout        |
| Prettier                         | 3.9.10                                                         |
| Oxc Prettier plugin              | 0.2.3                                                          |
| Package JSON plugin              | 3.0.2, resolving `sort-package-json` 3.6.1 in this lockfile    |
| TOML plugin                      | 3.0.2                                                          |
| XML plugin                       | 3.4.2                                                          |
| Astro plugin                     | 0.14.1                                                         |
| Svelte plugin/compiler           | 4.1.1 / 5.57.2                                                 |
| Tailwind plugin                  | 0.8.1                                                          |
| Tailwind used in isolated probes | 4.1.14, matching the installed-consumer fixture                |
| Oxfmt                            | 0.75.0, current npm `latest` when checked                      |
| Bun                              | 1.4.4, installed locally and current npm `latest` when checked |
| Development runtime              | Node 26.13.0, npm 11.20.0                                      |
| Measurement host                 | Apple M1, 8 logical CPUs, 8 GiB RAM, macOS arm64               |

The audit combined repository source and consumer tests, pinned upstream implementation/tests, official documentation, byte comparisons on 46 fixture cases, 75 additional option/edge probes, nested EditorConfig and outside-directory probes, and local CLI benchmarks. The 46 cases contain 38 existing formatter fixtures plus eight extension/nesting variants; the CommonJS variant uses valid CommonJS syntax. Every additional probe has a successful Prettier baseline. Test programs were isolated from the repository and upstream checkouts were kept clean.

The evidence includes inputs, resolved option metadata, candidate outputs, errors, migration warnings, raw timing samples, exact command arguments, upstream commits, and the audit harnesses. Fixture counts establish coverage of these inputs; they do not prove equivalence over arbitrary programs or every combination of options. Windows, Linux runner performance, other consumer repositories, minimum-runtime execution, editor responsiveness, install time, and memory usage were not measured.

## What the existing setup actually promises

| Contract | Existing behavior | Oxfmt 0.75.0 | Bun 1.4.4 with the existing Prettier config |
| --- | --- | --- | --- |
| Width | `printWidth: 150` | Same setting; default otherwise differs | Same setting |
| Element attributes | `singleAttributePerLine: true` | Same option for supported markup | Same option; native or fallback |
| Markdown/MDX prose | `proseWrap: "never"` only for `md`, `markdown`, `mdx` | Keep the scoped override | Reads the override |
| YAML prose | Prettier default `preserve` | Keep default; do not move Markdown's setting to the top level | Same default in probes |
| JS family | `oxc` for `js`, `cjs`, `mjs`, `jsx` | Native Oxc formatter; a different printer | Recognizes the Oxc plugin/object and parser names; native printer |
| TS family | `oxc-ts` for `ts`, `cts`, `mts`, `tsx` | Native formatter; automatic migration misclassifies TSX | Native printer; extension probes matched |
| Package JSON | Plugin-specific field ordering, script sorting, and JSON reserialization | Built-in sorting differs, including the real repository manifest | Built-in plugin emulation; ordinary fixtures match, some values differ |
| TOML | Plugin layout, quoting, comments, TOML version, and 16 other controls | Native engine with different defaults and no equivalent dedicated controls | Delegates whole TOML files to installed Prettier/plugin |
| XML family | XML printer with strict whitespace, mixed content, entities, CDATA, namespaces | Unsupported; retain another formatter | Delegates XML/SVG and other recognized XML-family extensions to installed Prettier/plugin |
| Astro | Optional 0.14.1 plugin | Opt-in bundled 1.1.2 plugin, requiring `@astrojs/compiler-rs` | Delegates whole Astro files to the installed 0.14.1 plugin |
| Svelte | Optional 4.1.1 plugin | Opt-in bundled 4.1.1 plugin, requiring `svelte` | Native implementation of 4.1.1 behavior |
| Tailwind | Optional plugin last; classes and `@apply`; six configured helpers | Built-in feature must be enabled and mapped manually | Recognized from the existing plugin list; helper probes match |
| Tailwind helpers | `clsx`, `cn`, `cva`, `classNames`, `classnames`, `tv`, including tagged templates and object values | Exact-name helper fixtures match | Fixtures and targeted options match |
| Custom Tailwind v4 theme | `tailwindStylesheet` relative to the config, including external working directories | Explicit config outside the project matched | Discovery matched; explicit `--config` from outside failed |
| Plugin loading | Absolute paths; absent optional packages are skipped; broken installations throw; Tailwind last | Cannot consume this general plugin contract | Recognizes known built-ins and delegates known language plugins; cannot emulate arbitrary printer plugins |
| Shareable config/public types | ESM default export typed as Prettier `Config`; required arrays/properties can be spread | Requires another configuration contract | Can keep importing the current package, which keeps its dependency and type requirements |

The existing Oxc plugin accelerates parsing; it still uses Prettier's printing pipeline. Moving to a native formatter changes more than the parser.

## Reproduced compatibility findings

### 1. Bun is close with the current config, but it is a hybrid

`bun fmt --check .` passed on the original checkout. With the current config and installed optional plugins, Bun matched all **46/46** fixture outputs. It also matched **71/75** additional text-output probes, including all 29 core-option probes, 17 TOML controls through fallback, all four XML controls through fallback, regular-expression Tailwind selectors, custom package field order, and custom theme sorting. The cursor probe also returned the expected cursor offset of 15.

The four additional differences were three package JSON edge cases and a Markdown file with plugin-language fences. Bun retained numeric token spelling/precision, escaped Unicode, duplicate keys, and the source position of integer-like keys where the package plugin reserializes or removes them. Those are intentional behavior differences, even when the new behavior preserves more source information. Bun documents its package JSON behavior in its [migration guide](https://bun.sh/guides/format/migrate-from-prettier).

Whole `.xml`, `.toml`, and `.astro` files matched because Bun called installed Prettier with the language plugins. This is verified in Bun's [pinned fallback implementation](https://github.com/oven-sh/bun/blob/38afee6c84fcf48c0edb2466aa4b27d287a59c30/src/lint/driver/fmt/prettier.rs) and [language-plugin table](https://github.com/oven-sh/bun/blob/38afee6c84fcf48c0edb2466aa4b27d287a59c30/src/lint/driver/fmt/config.rs#L300-L350). Removing Prettier or those plugins removes that coverage. Installing Bun does not require changing npm as the project's package manager.

### 2. Bun leaves some plugin code fences unformatted

With the unchanged Prettier plugin list, Bun's Markdown printer left the XML, TOML, and Astro fence contents in the additional probe unchanged. Prettier formatted them. The Svelte fence was formatted by both. Ordinary JS fences in the existing fixtures matched.

This matters to this configuration package because its Markdown contract includes embedded formatting. Keeping a fallback plugin installed does not make every embedded use of that language run through the fallback. If these fences occur in a consuming project and output parity is required, route the affected Markdown/MDX files to Prettier or retain Prettier for all Markdown/MDX. A hybrid router must give each file one authoritative formatter.

### 3. Bun has an outside-directory stylesheet path difference

For a project containing `tailwindStylesheet: "./theme.css"`, the following invocation from an unrelated directory failed with an `ENOENT` pointing to that unrelated directory's `theme.css`:

```sh
bun fmt --no-script --config /project/prettier.config.mjs --stdin-filepath /project/src/example.tsx
```

The same explicit-config invocation with Prettier succeeded. Both tools succeeded when they discovered the config from `--stdin-filepath` without an explicit `--config`. Oxfmt's explicit config succeeded from the unrelated directory as well. The resulting class order was checked against the package's custom-theme consumer assertion.

For a Bun pilot, run from the project root or use normal config discovery; test any editor/wrapper that passes an explicit config from another directory. This probe is recorded separately in the evidence rather than hidden in the main fixture totals.

### 4. Oxfmt's automatic migration loses important behavior

`oxfmt --migrate=prettier` exited successfully but warned about every plugin in this package: one imported Oxc plugin object and six absolute plugin paths. The migrator recognizes literal package names rather than normalizing those paths. It consequently wrote `sortPackageJson: false` and omitted Tailwind, Svelte, and Astro activation. The generated config matched only **28/46** fixture outputs.

It also converted the shared `oxc-ts` override into a `typescript` language association covering `.tsx`, causing the TSX fixture to fail to parse. Drop these redundant JS/TS associations and let extensions select the native parsers, or give TSX/JSX their own appropriate language associations. Native extension detection passed the manually configured probes.

The exact warnings and generated configuration are preserved. The cause is visible in the pinned [plugin matching and parser conversion code](https://github.com/oxc-project/oxc/blob/9b6fff42fa6edf0bec55861b6f0764c7b9acd86b/apps/oxfmt/src-js/cli/migration/migrate-prettier.ts). A successful migration command is insufficient evidence that this setup was migrated correctly.

### 5. Oxfmt cannot replace XML or all TOML behavior

With a manually translated configuration, Oxfmt matched **38/46** fixture outputs. Three formatted outputs differed: `complex.toml`, `quotes.toml`, and `width/package.json`. Four XML paths and the explicit `width/package-lock.json` stdin case were unsupported. The lockfile is intentionally ignored by the repository's normal formatting check, so that last gap affects explicit API/fixture coverage rather than the current CI file set.

The TOML differences are observable under current defaults:

```toml
# Current plugin output
"quoted key" = "hello"
zulu = "last alphabetically"  # Primary target

# Native Oxfmt output; Bun's native-only mode showed the same differences
"quoted key" = "hello"
zulu = "last alphabetically"  # Primary target
```

All 17 TOML-specific controls are listed in the inventory below. Oxfmt does not expose corresponding dedicated options; sending these keys in its configuration did not reproduce the plugin's output. Its [TOML option conversion](https://github.com/oxc-project/oxc/blob/9b6fff42fa6edf0bec55861b6f0764c7b9acd86b/apps/oxfmt/src/core/options/to_oxc_formatter_toml.rs) explicitly implements shared formatter settings rather than the plugin's TOML-specific controls. XML has no native or user-plugin replacement in Oxfmt. Do not count an unhandled extension as checked merely because a directory-level command succeeds.

### 6. Package sorting is not interchangeable

Oxfmt changed the actual repository `package.json`: its field order differed and the `keywords` array was alphabetized. In the width fixture, Prettier preserved the original keyword order while native Oxfmt and Bun's `bunfig.toml`-only sorting reordered it. Oxfmt also lacked the plugin's `packageSortOrder` customization in the additional probe. Its `sortPackageJson.sortScripts: true` can align script sorting, but does not solve field-order, keyword-order, or custom-order differences.

Bun's Prettier-config mode specifically emulates the package plugin and matched ordinary field ordering, custom `packageSortOrder`, script sorting, and keyword order in the probes. Its native `sortPackageJson` mode uses different semantics. Retaining a Prettier config and translating it to `bunfig.toml` are therefore separate migration choices, with different output risks. See the pinned [Bun npm sorting implementation](https://github.com/oven-sh/bun/blob/38afee6c84fcf48c0edb2466aa4b27d287a59c30/src/format/json/sort_package_json/npm.rs) and [Oxfmt-compatible sorting implementation](https://github.com/oven-sh/bun/blob/38afee6c84fcf48c0edb2466aa4b27d287a59c30/src/format/json/sort_package_json/oxfmt.rs).

### 7. Framework support and extensibility need separate decisions

Oxfmt bundles Prettier 3.9.10, Astro plugin 1.1.2, Svelte plugin 4.1.1, and an insider Tailwind plugin at the audited release. It delegates HTML, Vue, Svelte, Astro, MDX, and Handlebars work through its bundled JavaScript pipeline where needed. The simple Astro probes matched, but the installed 0.14.1 Astro plugin and its version-specific contract are not the implementation Oxfmt uses. Oxfmt requires explicit Astro/Svelte activation and the compiler packages; it does not reproduce the current optional-plugin resolution automatically. See its [language support documentation](https://oxc.rs/docs/guide/usage/formatter/language-support.html) and [pinned dependencies](https://github.com/oxc-project/oxc/blob/9b6fff42fa6edf0bec55861b6f0764c7b9acd86b/apps/oxfmt/package.json).

The six configured Tailwind helper names, object values, tagged templates, Vue bindings, and CSS/SCSS/Less `@apply` cases matched after explicit Oxfmt setup. Its exact-name `functions`/`attributes`, theme stylesheet/config, whitespace, and duplicate options have mappings. Regex selectors did not sort classes in the extra probes, and `tailwindPackageName` has no corresponding supported option. The current setup uses literal helper names, so regex is an extensibility gap rather than an active default regression. Oxfmt's [configuration reference](https://oxc.rs/docs/guide/usage/formatter/config-file-reference.html) documents the selector limitation.

Bun recognizes several built-ins and delegates known language plugins. An arbitrary plugin that changes a native printer is not automatically compatible; its migration guide describes rejection unless an unsupported override is accepted. Neither candidate replaces the general Prettier plugin API or the existing public `Config` type simply by changing a command.

### 8. EditorConfig, editor APIs, and config discovery differ

A nested `.editorconfig` selecting four-space indentation produced four spaces with Prettier and Bun, but two spaces with Oxfmt, which applied the root file. Oxfmt also does not directly use the `prettier` field in `package.json`, although its migration command can read it. Its documented limitations include those cases and experimental ternaries. These matter to consumers of the shareable package even though this repository currently has a single root EditorConfig. See [Oxfmt's unsupported features](https://oxc.rs/docs/guide/usage/formatter/unsupported-features.html).

Bun prefers an Oxfmt config if both are present. During a side-by-side pilot, explicitly select the intended config, from the project root, or use separate directories; otherwise a comparison can accidentally exercise Bun's Oxfmt semantics. Oxfmt's API supplies `format(fileName, source, options)` returning code/errors, rather than Prettier's config resolution, plugin inspection, and cursor API. Unsupported Oxfmt pragma/range/cursor keys can be ineffective without a corresponding behavior change; a matching whole-file string does not establish API equivalence.

Oxfmt has an LSP and documented VS Code, Zed, JetBrains, and Neovim integrations. Bun's CLI can be invoked by an editor through stdin. Neither is configured as this checkout's editor formatter by this audit. Keep editor and CI decisions aligned and test selection formatting and custom-theme paths before adoption. See [Oxfmt editor setup](https://oxc.rs/docs/guide/usage/formatter/editors.html).

## Performance measured locally

Seven measured runs followed two warmups, with a fresh process per invocation and rotating tool order. Every measured command exited zero. Timings include process startup and configuration/plugin loading, exclude npm wrapper/installation time, and use a warm filesystem. The repository corpus was frozen before adding the audit artifacts: **65 files, 287,752 bytes**. Candidate commands received exactly the same explicit file list.

| Workload | Current Prettier | Prettier with warm content cache | Oxfmt | Bun with current config |
| --- | --- | --- | --- | --- |
| Repository check, 65 files | 693 ms | 298 ms, 2.3× | 45 ms, 15.4× | 37 ms, 18.7× |
| One-file check, `index.mjs` | 169 ms | 139 ms, 1.2× | 42 ms, 4.0× | 32 ms, 5.2× |
| Mixed plugin fixtures, 46 files | 458 ms | Not measured | 642 ms for Oxfmt + Prettier, about 1.4× slower | 311 ms, 1.5× |

The Oxfmt repository copy was normalized once with Oxfmt before its successful check timings; only `package.json` changed. That performance result therefore does not imply a zero-diff migration. Bun's repository command used the existing source/config. For the mixed case, all files started in the existing Prettier output. The Oxfmt hybrid checked 35 files with Oxfmt and 11 XML/TOML/Astro/package files with Prettier, sequentially; it preserved the tested outputs. Bun used its ordinary built-in/fallback routing. The second process and plugin loading make splitting this small mixed workload slower.

These results support a strong speed benefit for repeated code-heavy CLI invocations, with much smaller benefits when plugin fallbacks dominate. They do not establish publisher benchmark ratios on this setup. The one-file test uses check mode as a process-startup proxy; it is not a benchmark of a persistent editor language server or write-mode latency.

The unchanged baseline's full `npm run validate` passed in **79.17 seconds** locally, including 73 tooling tests, 158 runtime tests, and eight package-smoke tests. Its formatter-only check was under one second in the separate benchmark. Replacing that check saves roughly 0.65 seconds on this corpus, under 1% of the observed serial validation duration. GitHub Actions installs, parallel critical paths, linting, typechecking, lifecycle tests, and consumer installs still need separate measurement. The current workflow runs the repository format check in the static job; it is not repeated in every runtime matrix job.

## Migration choices

| Choice | Suitability | What remains or changes |
| --- | --- | --- |
| Keep Prettier; enable `--cache --cache-strategy content` | Lowest change risk; useful incremental improvement | Same output/plugins; cache must be invalidated when shared-config or plugin behavior changes |
| Bun CLI with the existing shared Prettier config | Recommended first pilot for speed | Keep Prettier and fallback plugins, handle plugin-language fences and outside-directory explicit config, accept/reject package edge differences |
| Bun with a new `bunfig.toml` configuration | Suitable if changing the formatting contract is acceptable | Native TOML/package sorting differ; XML/Astro still need explicit legacy routing/config; no general plugin replacement |
| Oxfmt with a manually authored config and Prettier routing | Suitable for projects dominated by supported native formats | Maintain one routing policy, preserve legacy XML/TOML/package/Astro behavior where required, map optional activation and options, repair parser associations |
| Oxfmt as the only formatter for the complete published contract | Not suitable today | XML, dedicated TOML options, package behavior, nested EditorConfig, and API/extensibility gaps remain |
| Bun as the only formatter with Prettier/plugins removed | Not suitable today | Whole-file XML/TOML/Astro fallback and package/API requirements remain |

The caching timing assumes the cache is already populated. Persisting a cache in CI is a separate integration change, with restore/save overhead and invalidation keys. Prettier's cache alone does not identify changed plugin implementations; key any persistent cache on the lockfile, shared-config version/source, relevant config/theme files, and formatter version. No cache or script changes were made here.

For a Bun pilot in a consuming project, pin the tested Bun release, retain the current dependencies/config, run `bun fmt --doctor`, and compare a copy with `bun fmt --check .`. Where the differences above matter, define a deterministic file routing policy before making Bun the writer. Change format scripts and the Prettier stages of lint-staged together; retain the ESLint-fix stage and its warning policy. `bun fmt` writes files by default, while `prettier file.ts` prints to stdout. Use `--stdin-filepath` for editor pipes. A `fmt` package script can intercept `bun fmt`; wrappers can use `--no-script`. See the [Bun migration guide](https://bun.sh/guides/format/migrate-from-prettier).

For an Oxfmt pilot, author the config manually rather than accepting the generated result. The following is a starting point for native files, not a complete replacement config; route legacy formats and package JSON to Prettier where their existing behavior is required:

```json
{
  "printWidth": 150,
  "singleAttributePerLine": true,
  "sortImports": false,
  "sortPackageJson": false,
  "sortTailwindcss": {
    "functions": ["clsx", "cn", "cva", "classNames", "classnames", "tv"]
  },
  "svelte": true,
  "overrides": [
    {
      "files": ["**/*.{md,markdown,mdx}"],
      "options": { "proseWrap": "never" }
    }
  ]
}
```

Enable Tailwind and Svelte only in projects that used those optional features, provide the compiler/theme dependencies and stylesheet path, and keep import/JSDoc sorting off because this config does not enable those transformations. If choosing Oxfmt's package convention intentionally, opt in separately and review the manifest diff. Astro should stay on the current Prettier plugin for a strict pilot; native Oxfmt support requires a separately reviewed compiler/plugin migration.

The published package remains a Prettier configuration: its tests call Prettier APIs, its declarations import Prettier types, its consumer requirements include Prettier, and its runtime resolves mandatory plugins. A repository-local formatter change does not authorize deleting those dependencies or replacing its exports. A future Oxfmt-specific shareable configuration would need its own reviewed export/package contract, consumer tests, docs, and release decision. The five-file tarball and required CI/publishing checks should remain intact.

## Complete option inventory

This table comes from Prettier 3.9.10's installed `getSupportInfo()` with all configured plugins. It lists every exposed option, including inherited defaults and plugin extension options. `overrides` is a configuration structure and is covered above. An option name being recognized does not prove identical output for all inputs; the evidence distinguishes source/schema findings from executed alternate-value probes.

| Option | Current setting or inherited default | Oxfmt | Bun with existing config |
| --- | --- | --- | --- |
| `arrowParens` | `"always"` | Same-named option | Same-named option |
| `bracketSameLine` | `false` | Same-named option | Same-named option |
| `objectWrap` | `"preserve"` | Same-named option | Same-named option |
| `bracketSpacing` | `true` | Same-named option | Same-named option |
| `semi` | `true` | Same-named option | Same-named option |
| `experimentalOperatorPosition` | `"end"` | Same-named option | Same-named option |
| `experimentalTernaries` | `false` | Unsupported; even an explicit false is rejected | Same-named option |
| `singleQuote` | `false` | Same-named option | Same-named option |
| `jsxSingleQuote` | `false` | Same-named option | Same-named option |
| `quoteProps` | `"as-needed"` | Same-named option | Same-named option |
| `trailingComma` | `"all"` | Same-named option | Same-named option |
| `singleAttributePerLine` | `true` | Same-named option | Same-named option |
| `htmlWhitespaceSensitivity` | `"css"` | Same-named option | Same-named option |
| `vueIndentScriptAndStyle` | `false` | Same-named option | Same-named option |
| `proseWrap` | `never` for Markdown/MDX; `preserve` elsewhere | Same-named option | Same-named option |
| `packageSortOrder` | `[]` | No custom ordering equivalent | Recognized in Prettier-config mode |
| `tomlVersion` | `"v1.0.0"` | No dedicated equivalent | Installed Prettier/TOML plugin |
| `arrayBracketSpaceWidth` | `0` | No dedicated equivalent | Installed Prettier/TOML plugin |
| `arrayCommaSpaceWidth` | `1` | No dedicated equivalent | Installed Prettier/TOML plugin |
| `commentStyle` | `"normalize"` | No dedicated equivalent | Installed Prettier/TOML plugin |
| `dateTimeDelimiter` | `"T"` | No dedicated equivalent | Installed Prettier/TOML plugin |
| `groupBlankLinesLimit` | `1` | No dedicated equivalent | Installed Prettier/TOML plugin |
| `indentSubTables` | `false` | No dedicated equivalent | Installed Prettier/TOML plugin |
| `indentTableKeyValuePairs` | `false` | No dedicated equivalent | Installed Prettier/TOML plugin |
| `inlineTableBraceSpaceWidth` | `1` from bracketSpacing | No dedicated equivalent | Installed Prettier/TOML plugin |
| `inlineTableCommaSpaceWidth` | `1` | No dedicated equivalent | Installed Prettier/TOML plugin |
| `keyValueEqualsSignAlignment` | `false` | No dedicated equivalent | Installed Prettier/TOML plugin |
| `keyQuoteStyle` | Inherits stringQuoteStyle | No dedicated equivalent | Installed Prettier/TOML plugin |
| `stringQuoteStyle` | Double quotes from singleQuote: false | No dedicated equivalent | Installed Prettier/TOML plugin |
| `trailingCommentAlignment` | `false` | No dedicated equivalent | Installed Prettier/TOML plugin |
| `keyValueEqualsSignSpaceWidth` | `1` | No dedicated equivalent | Installed Prettier/TOML plugin |
| `tableBlankLines` | `1` | No dedicated equivalent | Installed Prettier/TOML plugin |
| `trailingCommentSpaceWidth` | `2` | No dedicated equivalent | Installed Prettier/TOML plugin |
| `xmlSelfClosingSpace` | `true` | Unsupported format | Installed Prettier/XML plugin |
| `xmlWhitespaceSensitivity` | `"strict"` | Unsupported format | Installed Prettier/XML plugin |
| `xmlSortAttributesByKey` | `false` | Unsupported format | Installed Prettier/XML plugin |
| `xmlQuoteAttributes` | `"preserve"` | Unsupported format | Installed Prettier/XML plugin |
| `astroAllowShorthand` | `false` | `astro.allowShorthand`; bundled plugin 1.1.2 | Installed Astro 0.14.1 plugin |
| `astroSkipFrontmatter` | `false` | `astro.skipFrontmatter`; bundled plugin 1.1.2 | Installed Astro 0.14.1 plugin |
| `svelte5CompilerPath` | `""` | No corresponding supported option | Accepted but ignored |
| `svelteSortOrder` | `"options-scripts-markup-styles"` | `svelte.sortOrder` | Native Svelte 4.1.1 option |
| `svelteAllowShorthand` | `true` | `svelte.allowShorthand` | Native Svelte 4.1.1 option |
| `svelteIndentScriptAndStyle` | `true` | `svelte.indentScriptAndStyle` | Native Svelte 4.1.1 option |
| `tailwindConfig` | Unset | `sortTailwindcss`.config | Prettier plugin option recognized |
| `tailwindEntryPoint` | Unset | `sortTailwindcss`.stylesheet (rename deprecated alias) | Prettier plugin option recognized |
| `tailwindStylesheet` | Unset | `sortTailwindcss`.stylesheet | Prettier plugin option recognized; explicit-config path caveat |
| `tailwindAttributes` | `[]` | `sortTailwindcss`.attributes; exact names only | Prettier plugin option recognized |
| `tailwindFunctions` | Six literal helper names listed above | `sortTailwindcss`.functions; exact names only | Prettier plugin option recognized |
| `tailwindPreserveWhitespace` | `false` | `sortTailwindcss`.preserveWhitespace | Prettier plugin option recognized |
| `tailwindPreserveDuplicates` | `false` | `sortTailwindcss`.preserveDuplicates | Prettier plugin option recognized |
| `tailwindPackageName` | `"tailwindcss"` | No corresponding supported option | Prettier plugin option recognized |
| `checkIgnorePragma` | `false` | No corresponding CLI/config/API behavior | Same-named option |
| `cursorOffset` | `-1` | No corresponding CLI/config/API behavior | Same-named option |
| `endOfLine` | `"lf"` | lf/crlf/cr; auto unsupported | Same-named option |
| `filepath` | Unset | CLI stdin-filepath / API filename | CLI stdin-filepath |
| `insertPragma` | `false` | No corresponding CLI/config/API behavior | Same-named option |
| `parser` | `oxc`/`oxc-ts` overrides; inferred elsewhere | Extension detection or language associations | Parser names select native engine or fallback |
| `plugins` | Four mandatory, three optional; Tailwind last | No external Prettier plugin loading | Known built-ins/fallbacks; not a general plugin API |
| `printWidth` | `150` | Same-named option | Same-named option |
| `rangeEnd` | `Infinity` | No corresponding CLI/config/API behavior | Same-named option |
| `rangeStart` | `0` | No corresponding CLI/config/API behavior | Same-named option |
| `requirePragma` | `false` | No corresponding CLI/config/API behavior | Same-named option |
| `tabWidth` | `2` | Same-named option | Same-named option |
| `useTabs` | `false` | Same-named option | Same-named option |
| `embeddedLanguageFormatting` | `"auto"` | Same-named option | Same-named option |

## Validation and evidence

- Focused baseline: `vitest run tests/config.test.ts tests/format.test.ts`, 75 tests passed.
- Original whole-tree checks: `npm run format:check` and `bun fmt --check .`, both passed.
- Full unchanged baseline: `npm run validate`, passed on development Node 26.13.0; the minimum Node 22.12 consumer and remote CI were not executed in this audit.
- Artifact formatting and `git diff --check` are verified after writing this report.
- No existing snapshots were changed, and no candidate formatter wrote into the original checkout.

To inspect or reproduce the experiment, use the commands, raw inputs, versions, and harness text in the [evidence JSON](formatter-migration-2026-10-30.evidence.json). The harnesses originally ran from an ignored `.tools/formatter-audit/` directory, with candidate dependencies in its isolated `tools/` prefix, and were moved outside the linted workspace before final validation. Restore that layout to rerun them; they write temporary corpora rather than formatting the checkout. The recorded dependency versions and upstream commits, rather than mutable `latest`, define this audit. Apply the repository's release-age policy before adopting a candidate dependency; this report evaluates Oxfmt 0.75.0, released October 27, without changing the project's dependency policy or lockfile.
