# Contributing

Please follow the [Code of Conduct](CODE_OF_CONDUCT.md) in all project
interactions.

## Setup

Development requires Node.js 24.15.0 or newer. The published configuration
supports Node.js 22.12.0 or newer.

Use the contributor Node.js version pinned in [.nvmrc](.nvmrc). If you use
nvm, run:

```bash
nvm install
nvm use
```

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

Use the [architecture guide](docs/architecture.md) to find runtime, declaration,
consumer, tooling, and native-process ownership. Its
[change recipes](docs/architecture.md#change-recipes) name the smallest checks for
plugin updates, formatter behavior, public types, subprocess lifecycle,
dependency/reference updates, and CI changes. Owned executable JavaScript is
linted with type information and checked by TypeScript; raw fixtures stay excluded.

## Effect reference

Before writing Effect code, run:

```bash
npm run setup:effect-reference
```

Read `repos/effect/LLMS.md`, then consult the relevant pinned source, examples,
and tests. Use public stable APIs only: inspect both module and symbol annotations
for unstable or experimental APIs, including examples. Keep reference checkouts
untouched and resolve imports through installed packages.

The explicit setup verifies version, tag, commit, origin, and clean checkout
contents. It refuses unexpected user content without deleting it. To update a
pin, preserve the existing checkout by moving it aside first. See the
[dependency recipe](docs/architecture.md#dependency-and-reference-updates) for the
coordinated packages and offline consistency checks.

Workspace Zed settings use local TypeScript through `vtsls` and hide `repos/`
from scans and auto-imports. The Effect plugin supplies editor diagnostics;
`npm run effect:check` runs them in the terminal because ordinary `tsc` does not
run editor plugins. `local/effect-stability` checks installed declarations during
linting, so normal validation works without a cloned reference.

## Validation

Before opening a pull request, run:

```bash
npm run validate
```

This runs `validate:static` followed by `validate:behavior`: offline Effect pin
checks, typechecking, Effect diagnostics, linting, formatting, pinned workflow
lint, package static analysis, tooling guards, runtime tests, and installed-consumer tests.
`prepublishOnly` and the publishing workflow use the same complete entry point.
Package smoke tests install the tarball and consumer tools
in a temporary project, so they need npm registry access or cached
dependencies.

Package tests reuse npm-installed base and optional consumers from normal and
external directories. `PRETTIER_CONFIG_CONSUMER_NODE` selects the runtime programs;
installed type compilation stays on development Node. See the
[consumer boundary](docs/architecture.md#installed-consumers) for fixtures,
provenance, and cleanup requirements.

The default peer scenario uses the exact development versions. To exercise the
declared lower bounds for Prettier and all three optional plugins, run:

```bash
PRETTIER_CONFIG_PEER_SCENARIO=minimum npm run test:package
```

`tests/helpers/peer-scenarios.ts` derives these bounds from `peerDependencies`
and rejects unsupported scenario names or missing explicit minima. Consumer
programs verify the installed Prettier version. The optional project explicitly
installs Svelte and Tailwind CSS 4.1.14 for its checked stylesheet configuration;
its custom theme/utility changes sorting from both working directories.
The scenario and consumer-runtime variables can be combined.

CI runs behavioral and package coverage on Linux Node 22/24/26, consumers on
Node 22.12.0, and minimum peers once on development Node. Process lifecycle tests
also run on macOS Node 24 through `npm run test:lifecycle`; Linux retains the
same lifecycle suite. Windows execution remains unverified.

CI owns repository static checks and tooling guards once on development Node 24,
then runs version-sensitive behavior and installed consumers on Node 22/24/26.
Each matrix job installs dependencies on Node 24, runs `node --run test:runtime`
on its selected runtime, then restores Node 24 for the package harness and type
compiler while consumer programs use the captured runtime executable. Each required
matrix status rejects failed, cancelled, or skipped static/minimum-peer/macOS
prerequisites through an explicit result gate. The required minimum-runtime and
Dependency Review names remain unchanged. See the
[CI ownership table](docs/architecture.md#ci-check-ownership) for the complete
command map; `validate:static` and `validate:behavior` are composable CI entry points,
and `npm run validate` remains the required final local check.

`npm test` and `npm run test:ui` retain all regular tests. `test:runtime` excludes
the ESLint-backed tooling guards, and `test:tooling` selects those guards on the
development runtime. Full validation runs both suites through its static and
behavior phases.

To run only a file or named case during development, use, for example:

```bash
npx vitest run tests/package-smoke-harness.test.ts
npx vitest run tests/config.test.ts -t "optional"
```

Finish with `npm run validate` and `git diff --check`. Treat local results and
remote CI separately. All required Node and Dependency Review contexts must
settle successfully before a PR is ready for review.

Focused tests fail locally as well as in CI (`allowOnly: false`). ESLint checks
ordinary tests, aliases, `.each`, Effect testers, and layer-provided helpers.
Skipped, pending, or conditional tests require a local rule exception explaining
why coverage is intentionally disabled; do not disable these guards for a file or
suite. Use explicit file/name filters during development.

Check workflow semantics locally with:

```bash
npm run lint:workflows
```

This command installs actionlint 1.7.12 from its pinned GitHub release into the
ignored `.tools/` cache on first use. It verifies archive and binary SHA-256 pins,
then rechecks cached binary contents on each run. Node and `tar` are required;
no global actionlint is used. Linux and macOS x64/arm64 binaries are pinned.
First use needs GitHub release access; a verified cache works offline. Actionlint
can also use optional ShellCheck/Pyflakes installations when present. Full
validation and CI include the workflow command. Review
`scripts/actionlint-reference.json` when updating the tool pin.

The pre-commit hook runs ESLint fixes and Prettier on staged files. Full
typechecking and tests run through `npm run validate` and in CI.

### Interactive test UI

Use [Vitest UI](https://vitest.dev/guide/ui) to browse results, inspect timings and
snapshot diffs, and rerun individual tests while developing:

```bash
npm run test:ui
```

This watches the same regular tests as `npm test`. Installed-consumer tests have
their own opt-in command because each run packs the package and creates temporary
npm installations:

```bash
npm run test:package:ui
```

Open the URL printed in the terminal, normally
`http://localhost:51204/__vitest__/`, including its token when present. Use
`-- --no-open` to prevent automatic browser opening. To run both commands at once,
give the second command a different port, for example:

```bash
npm run test:package:ui -- --api.port=51205
```

File and test-name filters also work with the UI:

```bash
npm run test:ui -- tests/format.test.ts -t "TypeScript"
```

The watch mappings in `vitest.config.ts` rerun affected tests when runtime files,
public declarations, raw fixtures, or consumer programs change. These inputs are
read through the filesystem or subprocesses rather than ordinary test imports.
The regular UI continues to exclude package tests, and the package UI stays
limited to installed consumers. Verify mapping changes with
`npx vitest run tests/vitest-watch.test.ts`.

Review snapshot changes before accepting them. Keep `vitest` and `@vitest/ui` on
the same exact version; Dependabot groups their updates. The UI is a development
tool; finish with `npm run validate` and `git diff --check`. CI and publishing
continue to use the existing complete validation commands.

### ESLint config inspection

Use [ESLint Config Inspector](https://github.com/eslint/config-inspector) to
explore the repository's flat config, see which rules apply to a file, and trace
overrides to their named config blocks:

```bash
npm run lint:inspect
```

Open the URL printed in the terminal, normally `http://127.0.0.1:7777/`. The
command leaves browser opening to you; use `-- --open` to open it automatically.
To select another port, use `npm run lint:inspect -- --port=7778`.

Enter a repository-relative path such as `index.mjs`, `tests/config.test.ts`, or
`tests/consumers/installed.mjs` in the config page's filepath filter to inspect
its matching config blocks and merged rules. Local blocks use the
`@cravingmaker/prettier-config/` prefix. Raw fixtures under `tests/fixtures/`
and dependency references under `repos/` remain ignored.

The inspector updates when the config or its local imports change. Use it when
reviewing lint overrides, then finish with `npm run validate` and
`git diff --check`.

### Dependency inspection

Use [Node Modules Inspector](https://github.com/antfu/node-modules-inspector) to
explore the installed dependency tree, filter production and development
dependencies, and inspect package sizes:

```bash
npm run deps:inspect
```

Open the URL printed in the terminal, normally `http://localhost:9999/`. The
command leaves browser opening to you; use `-- --open` to open it automatically.
To select another port, use `npm run deps:inspect -- --port=10000`.

Run reports without starting the UI:

```bash
npm run deps:report-duplicates
npm run deps:report-sizes -- --limit 10
```

Both reports cover the installed tree, including development dependencies. UI
filters do not limit the CLI reports. For machine-readable JSON, use `--silent`
to keep npm's script banner out of stdout:

```bash
npm run --silent deps:report-duplicates -- --json
npm run --silent deps:report-sizes -- --json --limit 10
```

Registry metadata is fetched by default and cached under
`node_modules/.cache/node-modules-inspector/`. For local analysis without metadata
requests, supply an inspector configuration with `fetchNpmMeta: false` using
`-- --config /path/to/config.mjs`.

Use these tools when reviewing dependency updates. Finish changes with the
required `npm run validate` checks.

## Releases

Release Please maintains a release pull request from conventional squash
commits on `main`. Use `fix: ...` for patch releases and `feat: ...` for minor
releases. Mark breaking changes with `!`, such as `fix!: ...`, or a
`BREAKING CHANGE:` commit footer. Breaking changes bump the minor version
while the package is below 1.0.0 and the major version afterward.

Changes limited to `chore: ...`, `docs: ...`, or `test: ...` do not start a
package release. Dependabot uses `fix(deps): ...` for production dependencies
and `chore(deps-dev): ...` for development dependencies. Review formatting
output changes from runtime plugin updates and mark breaking changes when
needed.

Review the proposed version and changelog before merging the release pull
request. Include consumer-facing migration guidance for formatting changes,
using `docs/releases/` when additional examples or instructions are needed.
The bot updates `package.json`, `package-lock.json`, the release manifest,
and `CHANGELOG.md`, then creates a `vX.Y.Z` tag and GitHub Release after the
pull request is merged. The GitHub Release triggers the existing npm
publishing workflow, which validates the package and uses Trusted Publishing.

To retry release automation, run the **Release Please** workflow manually
from the Actions tab with `main` selected. The release manifest records the
latest released version; its initial 0.3.0 version and bootstrap commit mark
the release that predates automation.

## Reporting issues

For formatting bugs, open a
[GitHub issue](https://github.com/cravingmaker/prettier-config/issues) with a
minimal input, the configuration used, actual and expected output, and the
package, Node.js, Prettier, and optional plugin versions.

Report vulnerabilities privately using [SECURITY.md](SECURITY.md).
