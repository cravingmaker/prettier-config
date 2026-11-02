# Architecture and change guide

## Ownership and package contracts

| Area | Owner | Contract |
| --- | --- | --- |
| Runtime configuration | [index.mjs](../index.mjs) | Published ESM object, consumed directly without compilation |
| Public declarations | [index.d.ts](../index.d.ts) | Required `plugins`, `overrides`, `singleAttributePerLine`, and `tailwindFunctions`; consumers can extend/spread them |
| Repository formatting | [prettier.config.mjs](../prettier.config.mjs) | Reuses the published runtime |
| Formatting behavior | [config tests](../tests/config.test.ts), [format tests](../tests/format.test.ts) | Defaults, parser selection, resolution, ordering, outputs, and reviewed snapshots |
| Packed consumers | [package tests](../tests/package.test.ts), [programs](../tests/consumers/) | Real npm installations with consumer-local plugins and tools, in a workspace that is removed after the tests or a failed setup |
| Commands | [command runner](../tests/helpers/command.ts) | Deadlines, abort signals, and failures that report the command, its directory, and its output |
| Development tools | [scripts](../scripts/), [lint config](../eslint.config.js), [compiler config](../tsconfig.json) | Typed owned code and the pinned workflow linter |
| CI and release | [workflows](../.github/workflows/), [package scripts](../package.json) | Required statuses and complete local/publishing validation |

The runtime is a small synchronous configuration object. Publishing it directly avoids a build artifact that could drift from the tested source.

Preserve Prettier defaults plus `singleAttributePerLine: true`, separate `oxc` JavaScript and `oxc-ts` TypeScript overrides, absolute plugin paths, and Tailwind last. Optional plugins may be absent. A broken installed optional package must propagate its original resolution error; package-presence inspection runs only after failed optional resolution.

`tailwindFunctions` configures class sorting in `clsx`, `cn`, `cva`, `classNames`, `classnames`, and `tv` when the Tailwind plugin is installed. Its required public array can be spread to add consumer-specific helper names without importing optional plugin types.

The five published files are `index.mjs`, `index.d.ts`, `package.json`, `README.md`, and `LICENSE`. Keep existing export paths, required public properties, dependency boundaries, and peer ranges. The runtime's JSDoc references `index.d.ts` explicitly; repository compilation checks that implementation against the required shape. Installed type tests also check valid extensions/spreads and reject invalid types.

## Installed consumers

The package suite packs once, shares one npm-installed base consumer, and shares one npm-installed optional consumer. Install the actual tarball and explicit consumer dependencies with npm. The suite sets them up before it registers its tests, so a failed setup removes the workspace itself; otherwise `afterAll` removes it. Repository dependency symlinks cannot establish installed-consumer compatibility.

`tests/consumers/installed.mjs` covers JavaScript, TypeScript, TSX, JSON, YAML, package.json ordering, XML, and both TOML cases. `optional.mjs` exercises Astro, Svelte, Tailwind ordering, Vue, and CSS-family stylesheets. Shared helpers check resolved parsers, default options, idempotence, and real plugin paths inside the consumer's `node_modules`; the base program also checks Oxc object identity and optional absence. The resolution program isolates broken package manifests in fresh Node processes to avoid metadata-cache effects. `tailwind.mjs` reuses the optional installation and loads a checked configuration with a relative `tailwindStylesheet` path. Its Tailwind v4 theme and utility produce a different class order from the ordinary configuration, with default formatting and idempotence checked in both cases. Svelte and Tailwind CSS are explicit fixture dependencies; they are not dependencies of the published configuration.

All runtime programs run from their project and an external working directory. Resolve fixtures relative to the program's file URL, not `process.cwd()`. Consumer code supports Node 22.12.0; avoid `import.meta.dirname`, which is not stable there. Use real paths when comparing macOS `/var` and `/private/var` aliases.

Executable support belongs in `tests/consumers/` and receives linting/typechecking. Raw formatter inputs remain in `tests/fixtures/`, excluded from repository tools. The intentional `tests/fixtures/installed-consumer/typecheck.ts` compiles only in the installed project using development Node and TypeScript.

To select the minimum runtime locally, use an already installed Node executable:

```bash
PRETTIER_CONFIG_CONSUMER_NODE=/absolute/path/to/node-22.12.0 npm run test:package
```

This variable does not select the test runner or compiler. Development requires Node >=24.15.0; use [.nvmrc](../.nvmrc) and the [contributor setup](../CONTRIBUTING.md#setup). Package tests need registry access or cached dependencies, and remove their temporary installations afterward.

The default `current` peer scenario installs exact development versions. `PRETTIER_CONFIG_PEER_SCENARIO=minimum` derives the lower bounds of Prettier and the three optional plugins from the manifest. Both scenarios run the same required, optional, custom stylesheet, public-type, and package-content assertions. Prettier's installed version is checked inside each runtime program. Minimum peers run once in CI, without multiplying peer combinations across the Node matrix. See the [contributor commands](../CONTRIBUTING.md#validation) for selecting peers and the consumer runtime independently.

Linux CI runs the runtime tests and the consumer programs on Node.js 22.12.0 and the newest 22, 24, and 26 releases. CI does not run on macOS or Windows.

## Commands

Tests run commands through `run` in the [command runner](../tests/helpers/command.ts), a thin wrapper of Node's `execFile`. Every command has a deadline, and a command that a test runs also receives the test's abort signal, so a timed-out or cancelled test stops its child process. A failure reports the command, its working directory, and both output streams, with Node's error as its `cause`. Keep each command's deadline shorter than its test's timeout, so that a test reports the command's own failure and output.

## Change recipes

For every recipe, run the targeted checks first, then `npm run validate` and `git diff --check`. Review the diff against the intended base, preserve unrelated work, open focused PRs, and verify remote checks separately. Full validation also remains the `prepublishOnly` entry point.

### Plugin updates

Update exact dependency/peer metadata only within the requested scope. Check release age and compatibility before installing with npm. Inspect plugin source, language metadata, and parser behavior where relevant; retain absolute resolution and Tailwind-last ordering. Adjust runtime/types only when needed. Run:

```bash
npx vitest run tests/config.test.ts tests/format.test.ts
npm run test:package
npm run lint:package
npm run typecheck:package
```

### Formatter behavior

Add a failing regression with representative raw fixtures before changing `index.mjs`. Run `npx vitest run tests/format.test.ts tests/config.test.ts` and `npm run test:package`. Show before/after output for intentional changes. Update only affected snapshots after review; never regenerate them to hide a regression. Check whether the existing [release guidance](../CONTRIBUTING.md#releases) requires migration notes or a breaking-change marker.

### Public types

Keep the runtime JSDoc contract and declarations consistent. Extend the installed type fixture with meaningful valid/invalid cases, retaining required-array spreads and the invalid-width assertion. Run `npm run typecheck`, `npm run test:package`, and `npm run typecheck:package` for compiler shape, installed resolution, and the ESM export profile.

### Dependency updates

Update exact dependency versions and root lockfile declarations/records together. Review the release notes of tools that change linting, type checking, or test behavior, and run `npm run validate`.

### CI changes

Map each existing command to its job before removing duplicated execution. Keep the `CI result` job's `needs` list complete: it is the only required status, so a job missing from that list cannot block a merge. Stacked PRs receive CI for feature branch bases as well as `main`. Run `npm run lint:workflows` with the repository's pinned actionlint; see [installation and cache details](../CONTRIBUTING.md#validation). Verify successful remote checks and a deliberate job failure when changing the gate. Do not accept a skipped job as success; only Dependency Review skips, outside pull requests.

## CI check ownership

`npm run validate` composes `validate:static` and `validate:behavior`. `npm run release:check` adds a dependency audit and a dry run of the tarball, and `prepublishOnly` and the publishing workflow run it, so they retain every check. CI uses these smaller entry points to give repository static analysis one owner while retaining behavior on each supported runtime.

| Commands/checks | CI owner | Coverage |
| --- | --- | --- |
| `npm audit signatures` | Static checks, development Node | Registry signatures and provenance attestations of installed packages |
| `typecheck` | Static checks, development Node | Required runtime shape and checked owned code |
| `lint`, `format:check`, `lint:workflows` | Static checks, development Node | Typed rules, test-mode guards, repository formatting, pinned actionlint |
| `lint:unused` | Static checks, development Node | Knip unused files, exports, dependencies, and unresolved imports |
| `lint:package`, `typecheck:package` | Static checks, development Node | Publint and ATTW's ESM package profile |
| `test:tooling` | Static checks, development Node | Workflow check failures and verification of the cached actionlint binary |
| `test:runtime` | Node.js 22.12.0, 22, 24, and 26 on Linux | Configuration, parser selection, plugin resolution, and formatting |
| `test:package`, current peers | Node.js 22.12.0, 22, 24, and 26 on Linux | Real npm consumers, custom stylesheets, public types, package contents |
| `test:package`, minimum peers | Minimum peer versions, development Node | The same package assertions at declared lower bounds |
| `npm audit --audit-level=low` | Dependency audit, development Node | Known vulnerabilities of the locked dependencies, including advisories published after the last change |
| Dependency Review action | Dependency Review, pull requests | New dependencies with known vulnerabilities of any severity |
| Every job above | CI result | The single required status |
| zizmor workflow | zizmor analysis | Workflow and Dependabot configuration security, reported to code scanning |
| CodeQL default setup | Repository-managed CodeQL analysis | Extended Actions and JavaScript/TypeScript queries |

Each matrix job installs dependencies on development Node before selecting its runtime. `node --run test:runtime` runs the runtime suite without invoking npm's development-engine check. The job captures that Node executable and restores development Node for npm and the installed type compiler, while consumer programs use the captured runtime.

`test:tooling` checks development tools, so it runs once through `validate:static` on development Node. `validate:behavior` composes `test:runtime` and `test:package`; full validation and publishing retain both phases. `npm test` and its UI include every test except the installed consumers.

All CI jobs run in parallel. `CI result` runs with `always()` after them and fails unless each job succeeded; only Dependency Review may skip, outside pull requests. A cancelled run therefore fails the gate rather than skipping it. The repository rules require only `CI result`, so renaming or adding a job needs no rule change. Existing strict/up-to-date repository rules are preserved.
