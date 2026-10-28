# @cravingmaker/prettier-config

[![npm version](https://img.shields.io/npm/v/%40cravingmaker%2Fprettier-config)](https://www.npmjs.com/package/@cravingmaker/prettier-config) [![CI](https://github.com/cravingmaker/prettier-config/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/cravingmaker/prettier-config/actions/workflows/ci.yml) [![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/cravingmaker/prettier-config/badge)](https://scorecard.dev/viewer/?uri=github.com/cravingmaker/prettier-config) [![License: MIT](https://img.shields.io/npm/l/%40cravingmaker%2Fprettier-config)](https://github.com/cravingmaker/prettier-config/blob/main/LICENSE)

Craving Maker's opinionated Prettier configuration. It keeps Prettier's defaults apart from three options, formats JavaScript and TypeScript with the Oxc parsers, and brings the plugins for `package.json`, TOML, and XML files.

- **Prettier's defaults, three changes.** `printWidth: 150`, `singleAttributePerLine: true`, and one line per paragraph in Markdown; every other option is Prettier's default.
- **Oxc for JavaScript and TypeScript.** The parsers of @prettier/plugin-oxc format JavaScript and TypeScript files.
- **More formats included.** `package.json` field order, TOML, and XML work without another installation.
- **Plugins when you install them.** The Astro, Svelte, and Tailwind CSS plugins load when the project installs them, with Tailwind last.
- **Typed and extendable.** The config is typed, and its arrays can be spread to add to them.

Its companion, [@cravingmaker/eslint-config](https://github.com/cravingmaker/eslint-config), leaves layout to Prettier; see [Using with ESLint](#using-with-eslint).

## Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Usage](#usage)
- [Settings](#settings)
- [Config files](#config-files)
- [Optional plugins](#optional-plugins)
- [Using with ESLint](#using-with-eslint)
- [Versioning](#versioning)
- [Contributing and security](#contributing-and-security)
- [License](#license)

## Requirements

- Node.js 22.12.0 or later.
- Prettier 3.9.8 or later, below 4.
- ES modules. The package is ESM-only, so a config file that extends it is an ES module; see [Config files](#config-files).

## Installation

```bash
npm install --save-dev --save-exact prettier @cravingmaker/prettier-config
```

With another package manager, add both packages as exact development dependencies: `yarn add --dev --exact`, `pnpm add --save-dev --save-exact`, or `bun add --dev --exact`.

Pin the exact version, as `--save-exact` does, because a release can change formatting; see [Versioning](#versioning). Astro, Svelte, and Tailwind CSS need plugins of their own; see [Optional plugins](#optional-plugins).

## Usage

Reference the config in the `package.json` of the project:

```json
{
  "prettier": "@cravingmaker/prettier-config"
}
```

Then run Prettier:

```bash
npx prettier --check .
```

`--check` reports the files that are not formatted, for CI, and `--write` formats them.

To change or add options, export the config from a `prettier.config.mjs` file instead, and remove the `"prettier"` field from `package.json`, which Prettier would otherwise read first:

```js
import config from "@cravingmaker/prettier-config";

export default {
  ...config,
  overrides: [
    ...config.overrides,
    // Add your own overrides here
  ],
};
```

## Settings

The config sets these options and leaves every other option to Prettier's defaults, or to the defaults of each plugin:

| Option | Value |
| --- | --- |
| `printWidth` | `150` |
| `singleAttributePerLine` | `true` |
| `overrides` | The `oxc-ts` parser for `**/*.{ts,cts,mts,tsx}`, the `oxc` parser for `**/*.{js,cjs,mjs,jsx}`, and `proseWrap: "never"` for `**/*.{md,markdown,mdx}` |
| `plugins` | The bundled plugins below, then the [optional plugins](#optional-plugins) that the project installs |
| `tailwindFunctions` | `clsx`, `cn`, `cva`, `classNames`, `classnames`, and `tv`; see [Tailwind CSS](#tailwind-css) |

`printWidth` is a wrapping preference, not a hard limit, and a plugin such as the `package.json` formatter applies its own layout. The Oxc parsers do not support Flow syntax.

An `.editorconfig` file still sets the indentation and line endings, which the config leaves to Prettier. Its `max_line_length` has no effect, because the config sets `printWidth`.

These plugins are dependencies of the package, so they need no installation:

| Plugin | Formats |
| --- | --- |
| [@prettier/plugin-oxc](https://www.npmjs.com/package/@prettier/plugin-oxc) | JavaScript and TypeScript, through the `overrides` above |
| [prettier-plugin-packagejson](https://www.npmjs.com/package/prettier-plugin-packagejson) | `package.json`, with its fields sorted by sort-package-json |
| [prettier-plugin-toml](https://www.npmjs.com/package/prettier-plugin-toml) | TOML files |
| [@prettier/plugin-xml](https://www.npmjs.com/package/@prettier/plugin-xml) | XML files |

### Markdown

Markdown and MDX files keep each paragraph, list item, and quotation on one line, and the editor wraps it on screen. GitHub renders a line break inside a paragraph as a break in issues, pull requests, comments, and release notes, so text reads the same there as in a Markdown file, and an edit never reflows the lines around it. YAML keeps its line breaks, so a long workflow condition stays on several lines. A table that is wider than `printWidth` prints without column padding.

Prettier joins the marker of a GitHub alert, such as `[!NOTE]`, with the line after it, and GitHub then shows a plain quotation. Follow the marker with an empty quoted line:

```md
> [!NOTE]
>
> The text of the note.
```

## Config files

The package is ESM-only, so the file that extends the config must be an ES module:

| Config file                              | Requirement                                                             |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| `.prettierrc.mjs`, `prettier.config.mjs` | None.                                                                   |
| `.prettierrc.mts`, `prettier.config.mts` | Node.js 22.18.0 or later.                                               |
| `.prettierrc.js`, `prettier.config.js`   | `"type": "module"` in your `package.json`.                              |
| `.prettierrc.ts`, `prettier.config.ts`   | Node.js 22.18.0 or later and `"type": "module"` in your `package.json`. |
| `.prettierrc.cjs`, `prettier.config.cjs` | Not supported. `require()` fails with `No "exports" main defined`.      |

Without `"type": "module"`, Node.js still loads `.js` and `.ts` config files, but prints a `MODULE_TYPELESS_PACKAGE_JSON` warning on every run.

## Optional plugins

The config loads these plugins when the project installs them. Install only the ones that you need:

| Plugin                        | Supported versions | Formats                                        |
| ----------------------------- | ------------------ | ---------------------------------------------- |
| `prettier-plugin-astro`       | `>=0.14.1 <0.15`   | `.astro` files                                 |
| `prettier-plugin-svelte`      | `>=4.1.1 <5`       | `.svelte` files                                |
| `prettier-plugin-tailwindcss` | `>=0.8.1 <1`       | The order of Tailwind CSS classes and `@apply` |

```bash
npm install --save-dev --save-exact prettier-plugin-tailwindcss
```

### Tailwind CSS

The Tailwind CSS plugin always loads last, as it requires. Besides class attributes, it sorts the classes in calls and tagged templates of `clsx`, `cn`, `cva`, `classNames`, `classnames`, and `tv`. To add another helper, extend `tailwindFunctions`:

```js
import config from "@cravingmaker/prettier-config";

export default {
  ...config,
  tailwindFunctions: [...config.tailwindFunctions, "tw"],
};
```

See [sorting classes in function calls](https://github.com/tailwindlabs/prettier-plugin-tailwindcss#sorting-classes-in-function-calls) for details.

With Tailwind CSS v4, set `tailwindStylesheet` to the project's Tailwind CSS entry point, so that the plugin sorts by your theme and custom utilities. The path is relative to the config file:

```js
import config from "@cravingmaker/prettier-config";

export default {
  ...config,
  tailwindStylesheet: "./src/app.css",
};
```

See [specifying your Tailwind stylesheet path](https://github.com/tailwindlabs/prettier-plugin-tailwindcss#specifying-your-tailwind-stylesheet-path-tailwind-css-v4) for details.

### Astro

Use `prettier-plugin-astro` 0.14. Its 1.x releases use a different syntax tree, in which `prettier-plugin-tailwindcss` 0.8.1 does not sort classes, so the supported range leaves them out.

## Using with ESLint

[@cravingmaker/eslint-config](https://github.com/cravingmaker/eslint-config) leaves layout to Prettier, so the two need no eslint-config-prettier between them. Run Prettier first, then ESLint:

```bash
npx prettier --check . && npx eslint .
```

## Versioning

Every release can change formatting, through a setting or an updated plugin, so pin the exact version, as the [installation](#installation) command does, and update on purpose. The bundled plugins are exact dependencies of this package, so they change only with a release of it. Before 1.0.0, breaking changes come in minor versions.

The [changelog](https://github.com/cravingmaker/prettier-config/blob/main/CHANGELOG.md) and the [releases](https://github.com/cravingmaker/prettier-config/releases) describe each version, and the [release notes](https://github.com/cravingmaker/prettier-config/tree/main/docs/releases) of 0.2.0 and 0.3.0 show how their formatting changed.

## Contributing and security

See [CONTRIBUTING.md](https://github.com/cravingmaker/prettier-config/blob/main/CONTRIBUTING.md) for contribution and pull request guidance, and follow the [Code of Conduct](https://github.com/cravingmaker/.github/blob/main/CODE_OF_CONDUCT.md) when participating in the project. Report vulnerabilities privately as described in the [security policy](https://github.com/cravingmaker/.github/blob/main/SECURITY.md).

## License

MIT © [cravingmaker](https://github.com/cravingmaker)
