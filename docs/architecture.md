# Architecture and change guide

## Ownership and package contracts

| Area                  | Owner                                                                                           | Contract                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Runtime configuration | [index.mjs](../index.mjs)                                                                       | Published ESM object, consumed directly without compilation                                     |
| Public declarations   | [index.d.ts](../index.d.ts)                                                                     | Required `plugins`, `overrides`, and `singleAttributePerLine`; consumers can extend/spread them |
| Repository formatting | [prettier.config.mjs](../prettier.config.mjs)                                                   | Reuses the published runtime                                                                    |
| Formatting behavior   | [config tests](../tests/config.test.ts), [format tests](../tests/format.test.ts)                | Defaults, parser selection, resolution, ordering, outputs, and reviewed snapshots               |
| Packed consumers      | [package tests](../tests/package.smoke.test.ts), [programs](../tests/consumers/)                | Real npm installations with consumer-local plugins and tools                                    |
| Resource lifetime     | [package harness](../tests/helpers/package-smoke.ts)                                            | Effect scopes release shared workspaces on success, failure, and interruption                   |
| Native processes      | [command adapter](../tests/helpers/node-command.ts)                                             | Process events, bounded buffers, process-tree disposal, and typed failures                      |
| Development tools     | [scripts](../scripts/), [lint config](../eslint.config.js), [compiler config](../tsconfig.json) | Typed owned code, stable API restrictions, decoded external data                                |
| CI and release        | [workflows](../.github/workflows/), [package scripts](../package.json)                          | Required statuses and complete local/publishing validation                                      |

The runtime is a small synchronous configuration object. Publishing it directly
avoids a build artifact that could drift from the tested source. Effect belongs
in development resource handling; introducing it into this object would add an
unnecessary runtime dependency and initialization boundary.

Preserve Prettier defaults plus `singleAttributePerLine: true`, separate `oxc`
JavaScript and `oxc-ts` TypeScript overrides, absolute plugin paths, and Tailwind
last. Optional plugins may be absent. A broken installed optional package must
propagate its original resolution error; package-presence inspection runs only
after failed optional resolution.

The five published files are `index.mjs`, `index.d.ts`, `package.json`, `README.md`,
and `LICENSE`. Keep existing export paths, required public properties, dependency
boundaries, and peer ranges. The runtime's JSDoc references `index.d.ts` explicitly;
repository compilation checks that implementation against the required shape.
Installed type tests also check valid extensions/spreads and reject invalid types.

## Installed consumers

The package suite packs once, shares one npm-installed base consumer, and shares
one npm-installed optional consumer. Install the actual tarball and explicit
consumer dependencies with npm. Repository dependency symlinks cannot establish
installed-consumer compatibility.

`tests/consumers/installed.mjs` combines all former base assertions: JavaScript,
TypeScript, TSX, JSON, YAML, package.json ordering, XML, and both TOML cases.
`optional.mjs` exercises Astro, Svelte, Tailwind ordering, Vue, and CSS-family
stylesheets. Shared helpers check resolved parsers, default options, idempotence,
and real plugin paths inside the consumer's `node_modules`; the base program also
checks Oxc object identity and optional absence. The resolution program isolates
broken package manifests in fresh Node processes to avoid metadata-cache effects.
The [plan's assertion inventory](../IMPROVEMENT_PLAN.md#stage-5-consolidate-installed-consumer-tests)
records the consolidation.

Both runtime programs run from their project and an external working directory.
Resolve fixtures relative to the program's file URL, not `process.cwd()`. Consumer
code supports Node 22.12.0; avoid `import.meta.dirname`, which is not stable there.
Use real paths when comparing macOS `/var` and `/private/var` aliases.

Executable support belongs in `tests/consumers/` and receives linting/typechecking.
Raw formatter inputs remain in `tests/fixtures/`, excluded from repository tools.
The intentional `tests/fixtures/installed-consumer/typecheck.ts` compiles only in
the installed project using development Node and TypeScript.

To select the minimum runtime locally, use an already installed Node executable:

```bash
PRETTIER_CONFIG_CONSUMER_NODE=/absolute/path/to/node-22.12.0 npm run test:package
```

This variable does not select the test runner or compiler. Development requires
Node >=22.22.1; use [.nvmrc](../.nvmrc) and the
[contributor setup](../CONTRIBUTING.md#setup). Package tests need registry access
or cached dependencies, and remove their temporary installations afterward.

## Effect and native process boundaries

Before authoring Effect code, follow the
[reference procedure](../CONTRIBUTING.md#effect-reference). The pin lives in
[effect-reference.json](../scripts/effect-reference.json). `repos/` is read-only
source material, excluded from lint, compilation, formatting, and packaging;
never import it into application code.

Use public stable APIs after consulting attached module and symbol annotations.
An ordinary import path or an upstream example does not prove stability. The
typed `local/effect-stability` rule follows aliases and attached installed
declarations, rejects unsupported process/experimental imports and reference
imports, and checks static/re-export/dynamic-literal forms. It distinguishes
decoded data from API namespaces and rejects nonliteral module loading and
namespace access. CommonJS Effect loading loses symbol types and is rejected;
use typed ESM. Arbitrary runtime indirection is not statically proven safe.
`npm run check:effect` separately catches unobserved Effects.

The native command adapter is intentional: upstream Effect process modules and
the corresponding platform spawner are unstable at the current pin. Effect
owns acquisition, release, deadlines, and interruption. Native Node owns process
listeners and mutable output buffers. Keep scoped finalizers awaited before
returning an error or deleting a workspace. Preserve command/phase/cwd context,
exit status, both output streams, UTF-8 decoding, and output limits.

POSIX commands run in process groups. Disposal must terminate descendants even
after the leader exits, escalate after the grace period, and close streams before
workspace cleanup. The existing Windows adapter path remains; Windows execution
is unverified. Real subprocess regressions use `it.live` or a suite excluding test
services so deadlines use a live clock. Do not substitute a virtual test clock
for operating-system process timing.

Foreign Git commands clear Git's repository-specific environment variables, as
specified in the [Git hook documentation](https://git-scm.com/docs/githooks).
This prevents hook variables such as `GIT_DIR` and `GIT_INDEX_FILE` from selecting
the caller's checkout while a fixture or reference setup operates elsewhere.

## Change recipes

For every recipe, run the targeted checks first, then `npm run validate` and
`git diff --check`. Review the diff against the intended base, preserve unrelated
work, open focused dependent PRs, and verify remote checks separately. Full
validation also remains the `prepublishOnly` entry point.

### Plugin updates

Update exact dependency/peer metadata only within the requested scope. Check
release age and compatibility before installing with npm. Inspect plugin source,
language metadata, and parser behavior where relevant; retain absolute resolution
and Tailwind-last ordering. Adjust runtime/types only when needed. Run:

```bash
npx vitest run tests/config.test.ts tests/format.test.ts
npm run test:package
npm run lint:package
npm run typecheck:package
```

### Formatter behavior

Add a failing regression with representative raw fixtures before changing
`index.mjs`. Run `npx vitest run tests/format.test.ts tests/config.test.ts` and
`npm run test:package`. Show before/after output for intentional changes. Update
only affected snapshots after review; never regenerate them to hide a regression.
Check whether the existing [release guidance](../CONTRIBUTING.md#releases) requires
migration notes or a breaking-change marker.

### Public types

Keep the runtime JSDoc contract and declarations consistent. Extend the installed
type fixture with meaningful valid/invalid cases, retaining required-array spreads
and the invalid-width assertion. Run `npm run typecheck`, `npm run test:package`,
and `npm run typecheck:package` for compiler shape, installed resolution, and the
ESM export profile.

### Subprocess lifecycle

Keep process mutation in the native adapter and lifetime/error composition in
the Effect harness. Consult the pin before changing Effect APIs. Add a regression
for the specific failure/deadline/interruption case. Run:

```bash
npx vitest run tests/package-smoke-harness.test.ts
npm run check:effect
npx vitest run tests/tooling-guards.test.ts
npm run test:package
```

Check real-clock cleanup and canonical paths on each configured CI platform.

### Dependency and reference updates

Keep `effect`, `@effect/platform-node-shared`, and `@effect/vitest` on the same exact
version, updating root lockfile declarations/records and the reference version,
tag, and full commit together. Dependabot groups these packages; the independently
versioned language service stays separate. Preserve an old checkout by moving it
aside yourself before setup; never reset or clean user content automatically.

Run `npm run check:effect-reference` offline, then explicitly run
`npm run setup:effect-reference` to verify the actual source commit and contents.
Read the new `LLMS.md` and re-audit APIs before adopting them. Run
`npx vitest run tests/effect-reference.test.ts tests/tooling-guards.test.ts` and
`npm run check:effect`. Decode external JSON through the stable Schema helper in
`scripts/manifest.mjs`, retaining file/phase context.

### CI changes

Map each existing command to its job before removing duplicated execution. Keep
the required `Node.js 22`, `Node.js 24`, `Node.js 26`, `Minimum Node.js 22.12.0`,
and `Dependency Review` contexts effective. Stacked PRs receive CI for feature
branch bases as well as `main`. Run actionlint using an explicitly installed
binary until Stage 7's pinned repository command is delivered. Verify successful
remote checks and deliberate prerequisite failures when changing dependencies
between jobs. Do not accept a skipped prerequisite as required-job success.

## Planned guardrail and CI additions

Stages 7–9 of the [implementation plan](../IMPROVEMENT_PLAN.md) are pending here:
pinned local/CI actionlint and test guards; minimum-peer, custom Tailwind stylesheet,
and macOS lifecycle coverage; then shared static CI ownership with explicit
required-job result gates. Existing CI runs full validation on Linux Node
22/24/26, plus consumers on minimum Node 22.12.0. These planned checks are not yet
claimed as delivered coverage.
