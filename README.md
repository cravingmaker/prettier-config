# @cravingmaker/prettier-config

A highly opinionated, modern, and elegant Prettier configuration crafted by
[the cravingmaker](https://github.com/cravingmaker).

## Installation

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

## License

MIT © [cravingmaker](https://github.com/cravingmaker)
