# Architecture and change guide

## Ownership and package contracts

| Area                  | Owner                                                                                           | Contract                                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Runtime configuration | [index.mjs](../index.mjs)                                                                       | Published ESM object, consumed directly without compilation                                                          |
| Public declarations   | [index.d.ts](../index.d.ts)                                                                     | Required `plugins`, `overrides`, `singleAttributePerLine`, and `tailwindFunctions`; consumers can extend/spread them |
| Repository formatting | [prettier.config.mjs](../prettier.config.mjs)                                                   | Reuses the published runtime                                                                                         |
| Formatting behavior   | [config tests](../tests/config.test.ts), [format tests](../tests/format.test.ts)                | Defaults, parser selection, resolution, ordering, outputs, and reviewed snapshots                                    |
| Packed consumers      | [package tests](../tests/package.smoke.test.ts), [programs](../tests/consumers/)                | Real npm installations with consumer-local plugins and tools                                                         |
| Resource lifetime     | [package harness](../tests/helpers/package-smoke.ts)                                            | Effect scopes release shared workspaces on success, failure, and interruption                                        |
| Native processes      | [command adapter](../tests/helpers/node-command.ts)                                             | Process events, bounded buffers, process-tree disposal, and typed failures                                           |
| Development tools     | [scripts](../scripts/), [lint config](../eslint.config.js), [compiler config](../tsconfig.json) | Typed owned code, stable API restrictions, decoded external data                                                     |
| CI and release        | [workflows](../.github/workflows/), [package scripts](../package.json)                          | Required statuses and complete local/publishing validation                                                           |

The runtime is a small synchronous configuration object. Publishing it directly
avoids a build artifact that could drift from the tested source. Effect belongs
in development resource handling; introducing it into this object would add an
unnecessary runtime dependency and initialization boundary.

Preserve Prettier defaults plus `singleAttributePerLine: true`, separate `oxc`
JavaScript and `oxc-ts` TypeScript overrides, absolute plugin paths, and Tailwind
last. Optional plugins may be absent. A broken installed optional package must
propagate its original resolution error; package-presence inspection runs only
after failed optional resolution.

`tailwindFunctions` configures class sorting in `clsx`, `cn`, `cva`, `classNames`,
`classnames`, and `tv` when the Tailwind plugin is installed. Its required public
array can be spread to add consumer-specific helper names without importing
optional plugin types.

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

`tests/consumers/installed.mjs` covers JavaScript,
TypeScript, TSX, JSON, YAML, package.json ordering, XML, and both TOML cases.
`optional.mjs` exercises Astro, Svelte, Tailwind ordering, Vue, and CSS-family
stylesheets. Shared helpers check resolved parsers, default options, idempotence,
and real plugin paths inside the consumer's `node_modules`; the base program also
checks Oxc object identity and optional absence. The resolution program isolates
broken package manifests in fresh Node processes to avoid metadata-cache effects.
`tailwind.mjs` reuses the optional installation and loads a checked configuration
with a relative `tailwindStylesheet` path. Its Tailwind v4 theme and utility produce
a different class order from the ordinary configuration, with default formatting
and idempotence checked in both cases. Svelte and Tailwind CSS are explicit fixture
dependencies; they are not dependencies of the published configuration.

All runtime programs run from their project and an external working directory.
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
Node >=24.15.0; use [.nvmrc](../.nvmrc) and the
[contributor setup](../CONTRIBUTING.md#setup). Package tests need registry access
or cached dependencies, and remove their temporary installations afterward.

The default `current` peer scenario installs exact development versions.
`PRETTIER_CONFIG_PEER_SCENARIO=minimum` derives the lower bounds of Prettier and
the three optional plugins from the manifest. Both scenarios run the same required,
optional, custom stylesheet, public-type, and package-content assertions. Prettier's
installed version is checked inside each runtime program. Minimum peers run once
in CI, without multiplying peer combinations across the Node matrix. See the
[contributor commands](../CONTRIBUTING.md#validation) for selecting peers and the
consumer runtime independently.

Linux CI covers Node 22/24/26 and consumer Node 22.12.0. Linux and macOS execute
the live-clock lifecycle suite; `npm run test:lifecycle` selects that suite alone.
Windows execution remains unverified.

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
`npm run effect:check` separately catches unobserved Effects.

The native command adapter is intentional: upstream Effect process modules and
the corresponding platform spawner are unstable at the current pin. The filesystem,
path, Node platform layers, and Vitest integration are also explicitly unstable in
Effect 4.0.2. The harness uses native Node filesystem/path APIs and ordinary Vitest
hooks instead. A stable `ManagedRuntime` shares layers and owns their disposal;
test abort signals interrupt scoped effects and Vitest waits for their finalizers.
The [native filesystem bridge](../tests/helpers/node-files.ts) waits for in-flight
I/O before a scope removes its workspace. Effect
owns acquisition, release, deadlines, and interruption. Native Node owns process
listeners and mutable output buffers. Keep scoped finalizers awaited before
returning an error or deleting a workspace. Preserve command/phase/cwd context,
exit status, both output streams, UTF-8 decoding, and output limits.

POSIX commands run in process groups. Disposal must terminate descendants even
after the leader exits, escalate after the grace period, and close streams before
workspace cleanup. A signal-zero probe returning `EPERM` still indicates an
existing group; Darwin can retain a zombie-only group until reaping completes.
Denied group signals wait for reaping within the cleanup grace period, then
preserve the permission error if the group still exists.
The existing Windows adapter path remains; Windows execution is unverified.
Real subprocess regressions run through ordinary Vitest tests and the live Effect
runtime. Do not substitute a virtual test clock for operating-system process timing.

Foreign Git commands clear Git's repository-specific environment variables, as
specified in the [Git hook documentation](https://git-scm.com/docs/githooks).
This prevents hook variables such as `GIT_DIR` and `GIT_INDEX_FILE` from selecting
the caller's checkout while a fixture or reference setup operates elsewhere.

## Change recipes

For every recipe, run the targeted checks first, then `npm run validate` and
`git diff --check`. Review the diff against the intended base, preserve unrelated
work, open focused PRs, and verify remote checks separately. Full
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
npm run effect:check
npx vitest run tests/tooling-guards.test.ts
npm run test:package
```

Check real-clock cleanup and canonical paths on each configured CI platform.

### Dependency and reference updates

Keep `effect`, `@effect/platform-node-shared`, and `@effect/vitest` on the same exact
version, updating root lockfile declarations/records and the reference version,
tag, and full commit together. Dependabot groups these packages; the independently
versioned language service stays separate.

The [Dependabot reference workflow](../.github/workflows/dependabot-effect-reference.yml)
runs after CI completes on a grouped Effect PR, including a failed initial pin
check. Its [updater](../scripts/dependabot-effect-reference.mjs) reads PR files as
data using trusted default-branch tooling. It accepts only open, same-repository
Dependabot Effect PRs targeting `main`, verifies matching manifest/lockfile pins,
resolves the upstream tag to a commit, and verifies all three upstream packages.
It changes only the reference JSON and requires the inspected PR head to remain
current. A synchronized reference is a no-op. Existing Release Please App
credentials create the commit with repository-scoped contents-write and
pull-requests-read permissions so normal PR CI runs again. The workflow must be
on `main` before it activates; rerun CI to synchronize an existing grouped PR.
Manual dependency updates still require updating the source pin together.

Preserve an old checkout by moving it aside yourself before setup; never reset or
clean user content automatically.

Run `npm run effect:check-reference` offline, then explicitly run
`npm run setup:effect-reference` to verify the actual source commit and contents.
Read the new `LLMS.md` and re-audit APIs before adopting them. Run
`npx vitest run tests/effect-reference.test.ts tests/tooling-guards.test.ts` and
`npm run effect:check`. Decode external JSON through the stable Schema helper in
`scripts/manifest.mjs`, retaining file/phase context.

### CI changes

Map each existing command to its job before removing duplicated execution. Keep
the `CI result` job's `needs` list complete: it is the only required status, so
a job missing from that list cannot block a merge. Stacked PRs receive CI for
feature branch bases as well as `main`. Run `npm run lint:workflows` with the
repository's pinned actionlint; see [installation and cache details](../CONTRIBUTING.md#validation).
Verify successful remote checks and a deliberate job failure when changing the
gate. Do not accept a skipped job as success; only Dependency Review skips,
outside pull requests.

## CI check ownership

`npm run validate` composes `validate:static` and `validate:behavior`. The local
command, `prepublishOnly`, and the publishing workflow retain every check. CI uses
these smaller entry points to give repository static analysis one owner while
retaining behavior on each supported runtime.

| Commands/checks                                       | CI owner                                  | Coverage                                                                         |
| ----------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------- |
| `npm audit signatures`                                | Static checks, development Node           | Registry signatures and provenance attestations of installed packages            |
| `effect:check-reference`, `typecheck`, `effect:check` | Static checks, development Node           | Offline pins, required runtime shape, checked owned code, Effect diagnostics     |
| `lint`, `format:check`, `lint:workflows`              | Static checks, development Node           | Typed rules, test/API guards, repository formatting, pinned actionlint           |
| `lint:unused`                                         | Static checks, development Node           | Knip unused files, exports, dependencies, and unresolved imports                 |
| `lint:package`, `typecheck:package`                   | Static checks, development Node           | Publint and ATTW's ESM package profile                                           |
| `test:tooling`                                        | Static checks, development Node           | Negative ESLint and compiler fixtures, focused-test guards                       |
| `test:runtime`                                        | Node.js 22/24/26 on Linux                 | Runtime behavior, native process lifecycle, reference and workflow tooling       |
| `test:package`, current peers                         | Node.js 22/24/26; Minimum Node.js 22.12.0 | Real npm consumers, custom stylesheets, public types, package contents           |
| `test:package`, minimum peers                         | Minimum peer versions, development Node   | The same package assertions at declared lower bounds                             |
| `test:lifecycle`                                      | macOS lifecycle, development Node         | Live-clock cleanup, process trees, interruption, deadlines, output limits, paths |
| Dependency Review action                              | Dependency Review, pull requests          | New dependencies with known vulnerabilities of any severity                      |
| Every job above                                       | CI result                                 | The single required status                                                       |
| zizmor workflow                                       | zizmor analysis                           | Workflow and Dependabot configuration security, reported to code scanning        |
| CodeQL default setup                                  | Repository-managed CodeQL analysis        | Extended Actions and JavaScript/TypeScript queries                               |

Each matrix job installs dependencies on development Node before selecting its
runtime. `node --run test:runtime` runs the runtime suite without invoking npm's
development-engine check. The job captures that Node executable and restores Node
24 for the package harness and installed type compiler, while consumer programs
use the captured runtime. The minimum-runtime job uses the same harness/compiler
boundary with consumer programs on Node 22.12.0.

`test:tooling` loads the repository ESLint configuration, whose development
dependency requires Node >=24.15.0. It runs once through `validate:static` on development Node. `validate:behavior` composes `test:runtime` and `test:package`; full validation
and publishing retain both phases. `npm test` and its UI still include every
regular test, with runtime and tooling selection checked through Vitest's actual
test discovery.

All CI jobs run in parallel. `CI result` runs with `always()` after them and
fails unless each job succeeded; only Dependency Review may skip, outside pull
requests. A cancelled run therefore fails the gate rather than skipping it.
The repository rules require only `CI result`, so renaming or adding a job
needs no rule change. Existing strict/up-to-date repository rules are preserved.
