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

Reference this config in your `package.json`:

```json
{
  "prettier": "@cravingmaker/prettier-config"
}
```

Or, export it from a `.prettierrc.{js,mjs,ts,mts}` or
`prettier.config.{js,mjs,ts,mts}` file:

```javascript
import config from '@cravingmaker/prettier-config';

export default {
  ...config,
  // Add your own overrides here
};
```

## XML formatting

XML support is bundled through [`@prettier/plugin-xml`](https://github.com/prettier/plugin-xml).
For `.xml` files, the configuration uses a 100-column print width, two-space
indentation, and double-quoted attributes. It inherits one attribute per line
from the base configuration and preserves attribute order.

The `preserve` whitespace mode formats structural markup while retaining text
whitespace. Use `xmlWhitespaceSensitivity: 'strict'` in your XML override if
all inter-element whitespace is significant to your application.

## TOML validation

TOML formatting is not a complete syntax or semantic validation step.
`prettier --check` (and this repository's `npm run format:check`) checks
whether files match the formatting rules; passing does not guarantee valid
TOML. For example, the bundled `prettier-plugin-toml@3.0.2` can format a
document containing duplicate keys without rejecting it.

If your project needs TOML validation, run a dedicated TOML validator or
parser in CI alongside the formatting check. Validate application-specific
schema requirements separately where applicable.

## Optional plugin compatibility

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

## License

MIT © [cravingmaker](https://github.com/cravingmaker)
