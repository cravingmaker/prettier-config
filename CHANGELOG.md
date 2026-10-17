# Changelog

## [0.4.0](https://github.com/cravingmaker/prettier-config/compare/v0.3.2...v0.4.0) (2026-10-17)


### ⚠ BREAKING CHANGES

* set print width to 150 ([#161](https://github.com/cravingmaker/prettier-config/issues/161))
* set print width to 130 ([#160](https://github.com/cravingmaker/prettier-config/issues/160))
* set print width to 120 ([#159](https://github.com/cravingmaker/prettier-config/issues/159))

### Features

* set print width to 120 ([#159](https://github.com/cravingmaker/prettier-config/issues/159)) ([69a26d2](https://github.com/cravingmaker/prettier-config/commit/69a26d2777df6a201d26528452c81dcc934e9c89))
* set print width to 130 ([#160](https://github.com/cravingmaker/prettier-config/issues/160)) ([40ae1d6](https://github.com/cravingmaker/prettier-config/commit/40ae1d616a13aaa606a8cd4bca98c95a0b7f3477))
* set print width to 150 ([#161](https://github.com/cravingmaker/prettier-config/issues/161)) ([f253f8d](https://github.com/cravingmaker/prettier-config/commit/f253f8d76e4a30c178d66cb13c99a1001ab13d86))
* sort Tailwind classes in helper functions ([#145](https://github.com/cravingmaker/prettier-config/issues/145)) ([95ee667](https://github.com/cravingmaker/prettier-config/commit/95ee667c3b649a242685cd9e2f58355d11609f30))


### Bug Fixes

* validate stacked PRs and reject broken optional plugins ([#123](https://github.com/cravingmaker/prettier-config/issues/123)) ([41d84c7](https://github.com/cravingmaker/prettier-config/commit/41d84c7e23b4f47f1938681ac339111e276a5988))

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
