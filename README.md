# @cravingmaker/prettier-config

A highly opinionated, modern, and elegant Prettier configuration crafted by
[the cravingmaker](https://github.com/cravingmaker).

## Installation

Requires Node.js 22.12.0 or newer.

Install the configuration along with Prettier using your favorite package
manager:

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
import config from "@cravingmaker/prettier-config";

export default {
  ...config
  // Add your own overrides here
};
```

## File-specific behavior

The base configuration uses tabs for indentation. Common data, markup, and
documentation formats use spaces where tabs are undesirable or unsupported.

- JSON, JSONC, and JSON5 use two-space indentation, double quotes, and no
  trailing commas.
- YAML and YML use two-space indentation.
- Markdown and MDX use two-space indentation with an 80-character print width.
- `package.json` and `package-lock.json` keep their dedicated 80-character
  print-width override.

## Development

`index.mjs` is the runtime configuration and is published directly alongside
`index.d.ts`. The repository uses it through `prettier.config.mjs`; no build
step is required. TypeScript checks the JavaScript configuration via JSDoc
and the TypeScript tests with `npm run typecheck`.

Run `npm ci` to install dependencies and `npm run validate` to run all checks.

## License

MIT © [cravingmaker](https://github.com/cravingmaker)
