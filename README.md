# @cravingmaker/prettier-config

A highly opinionated, modern, and elegant Prettier configuration crafted by
[the cravingmaker](https://github.com/cravingmaker).

## Installation

Requires Node.js 22.12.0 or newer.

Install the configuration along with Prettier using your favorite package
manager. TOML and XML support are included automatically:

```bash
npm install --save-dev --save-exact prettier @cravingmaker/prettier-config
```

```bash
yarn add --dev --exact prettier @cravingmaker/prettier-config
```

```bash
pnpm add --save-dev --save-exact prettier @cravingmaker/prettier-config
```

```bash
bun add --dev --exact prettier @cravingmaker/prettier-config
```

## Usage

The config uses Prettier's formatting defaults with `singleAttributePerLine: true`.
JavaScript and TypeScript files use the bundled Oxc parsers.
Flow syntax is not supported.

See the [changelog](https://github.com/cravingmaker/prettier-config/blob/main/CHANGELOG.md)
for release history and migration notes.

Reference this config in your `package.json`:

```json
{
  "prettier": "@cravingmaker/prettier-config"
}
```

Or, to extend it, export it from a `.prettierrc.mjs` or `prettier.config.mjs`
file:

```javascript
import config from "@cravingmaker/prettier-config";

export default {
  ...config,
  overrides: [
    ...config.overrides,
    // Add your own overrides here
  ],
};
```

This package is ESM-only, so the config file must be an ES module:

| Config file                              | Requirement                                                             |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| `.prettierrc.mjs`, `prettier.config.mjs` | None.                                                                   |
| `.prettierrc.mts`, `prettier.config.mts` | Node.js 22.18.0 or newer.                                               |
| `.prettierrc.js`, `prettier.config.js`   | `"type": "module"` in your `package.json`.                              |
| `.prettierrc.ts`, `prettier.config.ts`   | Node.js 22.18.0 or newer and `"type": "module"` in your `package.json`. |
| `.prettierrc.cjs`, `prettier.config.cjs` | Not supported. `require()` fails with `No "exports" main defined`.      |

Without `"type": "module"`, Node.js still loads `.js` and `.ts` config files
but prints a `MODULE_TYPELESS_PACKAGE_JSON` warning on every run.

## Optional plugins

The config detects these plugins when they are installed in your project and
loads them automatically. Install only the ones you need:

| Plugin                        | Supported versions | Formats                               |
| ----------------------------- | ------------------ | ------------------------------------- |
| `prettier-plugin-astro`       | `>=0.14.1 <0.15`   | `.astro` files                        |
| `prettier-plugin-svelte`      | `>=4.1.1 <5`       | `.svelte` files                       |
| `prettier-plugin-tailwindcss` | `>=0.8.1 <1`       | Tailwind CSS class and `@apply` order |

```bash
npm install --save-dev --save-exact prettier-plugin-tailwindcss
```

The Tailwind plugin is always loaded last, as it requires.

### Tailwind CSS v4

Set `tailwindStylesheet` to your project's existing Tailwind CSS entry point
so the plugin can use your theme and custom utilities when sorting classes:

```javascript
// prettier.config.mjs
import config from "@cravingmaker/prettier-config";

export default {
  ...config,
  tailwindStylesheet: "./src/app.css",
};
```

The stylesheet path is relative to this configuration file. Replace
`./src/app.css` with the path to your project's Tailwind stylesheet.

If you followed the `package.json` example above, remove its `"prettier"`
field when adding this configuration file.

See the [Tailwind plugin documentation](https://github.com/tailwindlabs/prettier-plugin-tailwindcss#specifying-your-tailwind-stylesheet-path-tailwind-css-v4)
for more details.

### Astro compatibility

For Astro files, use `prettier-plugin-astro@0.14.1`. This package supports
the `0.14.x` series alongside `prettier-plugin-tailwindcss@0.8.1`.
Astro plugin `1.x` uses a different AST that Tailwind plugin `0.8.1` does
not support for class sorting. The Astro peer range excludes `1.x` until
a compatible combination is verified.

## Development

`index.mjs` is the runtime configuration and is published directly alongside
`index.d.ts`. The repository uses it through `prettier.config.mjs`; no build
step is required. TypeScript checks the JavaScript configuration via JSDoc
and the TypeScript tests with `npm run typecheck`.

Development requires Node.js 22.22.1 or newer. The published configuration
still supports Node.js 22.12.0 or newer.

Set up a local checkout with:

```bash
npm ci
npm run prepare
```

The repository sets `ignore-scripts=true`, so installation does not run
lifecycle scripts automatically. Run `npm run prepare` explicitly once per
checkout to activate Husky Git hooks. CI keeps hooks disabled.

Run `npm run validate` to run all checks. For staged files covered by ESLint,
the pre-commit hook runs ESLint fixes before Prettier; other files run
Prettier only.

`npm run test:package` also installs the packed tarball, Prettier, and
TypeScript into a temporary consumer project. This check needs npm registry
access (or a populated npm cache); the temporary project is removed afterward.

## Contributing and security

See [CONTRIBUTING.md](https://github.com/cravingmaker/prettier-config/blob/main/CONTRIBUTING.md)
for contribution and pull request guidance. Report vulnerabilities privately
as described in [SECURITY.md](https://github.com/cravingmaker/prettier-config/blob/main/SECURITY.md).

## License

MIT © [cravingmaker](https://github.com/cravingmaker)
