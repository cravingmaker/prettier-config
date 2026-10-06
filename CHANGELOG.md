# Changelog

## [0.3.2](https://github.com/cravingmaker/prettier-config/compare/v0.3.1...v0.3.2) (2026-10-06)


### Bug Fixes

* **deps:** bump source-map-js from 1.2.1 to 1.2.2 ([#95](https://github.com/cravingmaker/prettier-config/issues/95)) ([f0acf77](https://github.com/cravingmaker/prettier-config/commit/f0acf779969a1b6c1717ade5d5bdbe02ced86a38))

## [0.3.1](https://github.com/cravingmaker/prettier-config/compare/v0.3.0...v0.3.1) (2026-10-06)


### Bug Fixes

* type always-set config keys as present and correct usage docs ([#102](https://github.com/cravingmaker/prettier-config/issues/102)) ([352dd56](https://github.com/cravingmaker/prettier-config/commit/352dd5624764c33b4d6c6d3dff0cd3896c540e64))

## 0.3.0 - 2026-10-06

### Changed

- Uses Prettier's formatting defaults except for `singleAttributePerLine: true`
  and the JavaScript/TypeScript Oxc parser overrides. The default base layout
  changes from 120 columns, tabs, and single quotes to 80 columns, spaces, and
  double quotes.
- Removes language-specific formatting overrides. Data formats inherit the
  default print width; JSONC and JSON5 inherit Prettier's default trailing
  commas. XML inherits strict whitespace handling and preserves attribute quotes.
- Lets the installed plugins infer Astro, Svelte, TOML, and XML parsers from
  filenames.

### Added

- Includes the MIT `LICENSE` file in the npm package.

See the [0.3.0 migration notes](docs/releases/0.3.0.md) before upgrading.

[Changes since 0.2.0](https://github.com/cravingmaker/prettier-config/compare/v0.2.0...v0.3.0)

## 0.2.0 - 2026-09-30

- Adds bundled TOML and XML formatting.
- Publishes the ESM runtime and public TypeScript declarations directly, and
  resolves plugins relative to the installed configuration.
- Requires Node.js 22.12.0 or newer and Prettier `>=3.9.8 <4`, with explicit
  compatibility ranges for optional Astro, Svelte, and Tailwind plugins.

See the [0.2.0 release notes](docs/releases/0.2.0.md) for formatting changes and
migration guidance from 0.1.12. Earlier versions are listed in
[GitHub Releases](https://github.com/cravingmaker/prettier-config/releases).
