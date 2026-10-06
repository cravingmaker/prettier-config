# Contributing

## Setup

Development requires Node.js 22.22.1 or newer. The published configuration
supports Node.js 22.12.0 or newer.

From a local checkout, run:

```bash
npm ci
npm run prepare
```

The repository disables installation scripts, so run `npm run prepare`
explicitly once per checkout to activate Husky hooks.

See [README.md](README.md) for the runtime configuration and supported plugin
versions.

## Making changes

Create a branch from the latest `main` and keep each pull request focused.
Use a conventional pull request title, such as `fix: ...`, `test: ...`, or
`docs: ...`. Describe the problem and resulting behavior, including
before/after examples when formatter output changes.

Add relevant regression tests for behavior changes. Formatting fixtures live
in `tests/fixtures/` and are excluded from linting and formatting checks.
Review snapshot diffs and update snapshots only when the output change is
intentional. For runtime or plugin changes, exercise packed consumers in
`tests/package.smoke.test.ts` as well.

## Validation

Before opening a pull request, run:

```bash
npm run validate
```

This runs typechecking, linting, formatting checks, tests, and package
integrity checks. Package smoke tests install the tarball and consumer tools
in a temporary project, so they need npm registry access or cached
dependencies.

The pre-commit hook runs ESLint fixes and Prettier on staged files. Full
typechecking and tests run through `npm run validate` and in CI.

## Reporting issues

For formatting bugs, open a
[GitHub issue](https://github.com/cravingmaker/prettier-config/issues) with a
minimal input, the configuration used, actual and expected output, and the
package, Node.js, Prettier, and optional plugin versions.

Report vulnerabilities privately using [SECURITY.md](SECURITY.md).
