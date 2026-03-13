# @cravingmaker/prettier-config

A highly opinionated, modern, and elegant Prettier configuration crafted by cravingmaker.

## Installation

Install the configuration along with Prettier using your favorite package manager:

```bash
npm install --save-dev prettier @cravingmaker/prettier-config
```
```bash
yarn add --dev prettier @cravingmaker/prettier-config
```
```bash
pnpm add -D prettier @cravingmaker/prettier-config
```
```bash
bun add -D prettier @cravingmaker/prettier-config
```

## Usage

Reference this config in your `package.json`:

```json
{
  "prettier": "@cravingmaker/prettier-config"
}
```

Or, export it from an `.prettierrc.js`, `prettier.config.js`, or `prettier.config.mjs` file:

```javascript
import config from '@cravingmaker/prettier-config';

export default {
  ...config,
  // Add your own overrides here
};
```

## License

MIT © [cravingmaker](https://github.com/cravingmaker)
