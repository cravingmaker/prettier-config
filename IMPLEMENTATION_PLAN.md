# Effect v4 implementation plan

Date: 2026-10-09

Status: implemented. This document records the accepted design and implementation
sequence; verification results are recorded below.

## Objective

Adopt Effect v4 in the package smoke-test harness to manage temporary resources,
run subprocesses asynchronously, and report failures with useful context. Keep
Vitest responsible for test registration and assertions.

The implementation covers `tests/package.smoke.test.ts`, its setup helpers,
Effect language-service diagnostics, a pinned local source reference, agent
guidance, and project-local Zed configuration. These previously optional
developer tools are included in the implementation scope.

The published Prettier configuration, formatting fixtures, consumer programs,
and release workflows remain outside this migration.

## Baseline behavior and problem

Before this change, `tests/package.smoke.test.ts` created a temporary directory and ran `npm pack`
during module evaluation. Its `afterAll` cleanup hook is registered afterward.
Packing or tarball validation can therefore fail before cleanup is registered.

The suite also used `execFileSync` for packing, extraction, installation, consumer
execution, and compilation. These commands block the test runner. Moving them
to asynchronous scoped subprocesses will allow Effect deadlines and interruption
to release process resources.

The existing six smoke tests provide the package-contract coverage to retain:

| Check              | Required behavior                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------- |
| Package contents   | Exactly `LICENSE`, `README.md`, `index.d.ts`, `index.mjs`, and `package.json`                                  |
| Installed package  | Install the tarball with npm; validate runtime consumption and public types                                    |
| Base consumers     | Exercise both consumer-directory and external working directories                                              |
| Optional consumers | Install pinned optional plugins once; reuse the installation for both working directories                      |
| Plugin resolution  | Retain the consumer-local resolution and Tailwind-last assertions in the existing consumer programs            |
| Minimum runtime    | Execute consumers through `PRETTIER_CONFIG_CONSUMER_NODE`; run TypeScript with the development Node executable |

## Dependency decision

Add `effect`, `@effect/platform-node-shared`, `@effect/vitest`, and
`@effect/language-service` as exact development dependencies. The shared adapter
exposes the Node filesystem, path, and child-process services needed by this
harness. Its documented modules are
available directly through
[`@effect/platform-node-shared`](https://effect.website/docs/v4/api/platform-node-shared).

Use the shared adapter to keep the dependency scope focused. Registry inspection
shows that the full `@effect/platform-node@4.0.0` adapter also declares an Undici
dependency and a Redis peer. The shared adapter declares `ws`, `@types/ws`, and
an Effect peer, so it still adds development dependencies to the lockfile.

Use `@effect/vitest` for scoped tests and shared suite layers. Its published
`4.0.0` package accepts Vitest `>=5.0.0 <6.0.0`, which includes this repo's
`5.0.2`. Its test bridge connects Vitest cancellation to Effect interruption and
waits for interrupted test finalizers through a test-finished hook. This avoids
maintaining a custom promise bridge. See the
[integration implementation](https://github.com/Effect-TS/effect/blob/main/packages/vitest/src/internal/internal.ts)
and [package metadata](https://github.com/Effect-TS/effect/blob/main/packages/vitest/package.json).

On 2026-10-09, registry metadata reports `4.0.2` as the latest version of the
three synchronized v4 packages. Version `4.0.0` was published on October 1 and is
the selected version compatible with `.npmrc`'s `min-release-age=7`. Versions `4.0.1`
and `4.0.2` are newer than that cutoff. These are planning-time observations;
implementation rechecked publication dates using npm metadata.

The language service is independently versioned. Registry metadata reports
`0.87.4` as latest, published on October 6; `0.87.3`, published on September 28,
is the selected exact pin allowed by the seven-day policy. Its TypeScript
6.0.3 and Effect v4 diagnostics were verified through the CLI and Zed's installed
vtsls server. It does not need to share the core packages' version number.

Dependency steps:

1. Choose the latest matching stable v4 versions permitted by the seven-day
   policy, starting with `4.0.0` if implementation begins now. Select an eligible
   language-service release separately, starting with `0.87.3`.
2. Verify the selected versions' exports, Node engines, peer requirements, and
   transitive dependencies. Current API pages can describe a newer version than
   the eligible package.
3. Install with npm and exact versions; retain `.npmrc`'s release-age and
   `ignore-scripts` settings. Regenerate `package-lock.json` through npm.
4. Confirm all four packages are development-only and absent from runtime
   dependencies, public declarations, and consumer installation commands.

The repo's TypeScript 6.0.3, strict checking, and development Node floor satisfy
Effect's [documented core requirements](https://github.com/Effect-TS/effect#requirements).
Retain the existing Vitest runner and assertions, using `@effect/vitest` only in
the migrated smoke suite and its harness regressions. No build step is required.

The [ecosystem evaluation](./EFFECT_ECOSYSTEM_EVALUATION.md) covers every public
package in the official v4 monorepo and related developer tools. The selected
language service, source reference, and Zed setup are part of this implementation.

## Harness design

### File layout

| File                                  | Planned change                                                                                                  |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `package.json`, `package-lock.json`   | Add four exact development dependencies plus source-setup and diagnostic scripts                                |
| `tests/helpers/package-smoke.ts`      | Add Effect-based resource acquisition, command execution, and consumer setup helpers                            |
| `tests/package.smoke.test.ts`         | Use Effect-aware tests and shared layers, retaining the existing assertions                                     |
| `tests/package-smoke-harness.test.ts` | Add local regression tests for cleanup, subprocess failure, deadlines, and interruption                         |
| `eslint.config.js`                    | Exclude source references, remove obsolete synchronous-process exceptions, and scope necessary helper overrides |
| `scripts/setup-effect-reference.mjs`  | Add the reproducible Node/Git reference-checkout command                                                        |
| `scripts/effect-reference.json`       | Record the upstream repository, matching Effect release, tag, and immutable commit                              |
| `.gitignore`, `.prettierignore`       | Exclude `repos/` from Git and formatting                                                                        |
| `vitest.config.ts`                    | Limit test discovery to package tests and exclude reference sources while preserving default exclusions         |
| `tsconfig.json`                       | Register the language-service plugin, check the setup script/config, and exclude `repos/`                       |
| `AGENTS.md`                           | Direct agents to the pinned read-only reference and relevant Effect source and tests                            |
| `.zed/settings.json`                  | Configure source exclusions, auto-import exclusions, and workspace TypeScript                                   |
| `README.md`                           | Document contributor setup, reference updates, Zed behavior, and diagnostics                                    |

The existing `tests/**/*.ts` TypeScript include already covers both new test files.
Add the setup script and Vitest configuration to the checked TypeScript inputs.
Consumer `.mjs` programs continue to run as independent consumers and do not
import the development harness.

### Suite lifetime

Use one shared harness layer through the named `layer` helper from
`@effect/vitest`. Its service contains the immutable workspace and tarball paths
and exposes the required setup operations. Compose the Node filesystem and path
layers with `NodeChildProcessSpawner.layer`; the spawner requires both services.
Provide those services to the harness and its operations.

Use `layer(harnessLayer, { excludeTestServices: true, timeout: "60 seconds" })`
with a suite name, then register tests through the callback's `it.effect`.
Excluding test services retains the live clock and console: real npm installs
and subprocess deadlines must not depend on advancing a test clock. Standalone
filesystem/process regressions use `it.live`. The
[Vitest helper API](https://github.com/Effect-TS/effect/blob/main/packages/vitest/src/index.ts)
supports these scopes and nested shared layers.

The lifecycle should be:

1. Define the named shared-layer suite. The helper registers setup and teardown;
   module evaluation performs no filesystem or command work.
2. Acquire the workspace in a scope owned by the harness layer, using
   `FileSystem.makeTempDirectoryScoped` or an explicit `Effect.acquireRelease`
   when cleanup diagnostics require it. Register release immediately after
   allocation, before packing or examining tarballs.
3. Pack once and require exactly one tarball. Close the acquisition scope before
   propagating a setup failure; after success, retain it for the shared layer's
   lifetime. Verify partial-failure cleanup rather than relying only on a later
   suite teardown hook.
4. Run tests against the shared tarball. Use a nested `it.layer` with a
   180-second hook budget for the optional-consumer service, installing once and
   reusing it for both working-directory checks. It inherits live services.
5. Return every operation as part of the test's Effect so interruption and
   finalizers remain connected to the test lifecycle. Do not start detached
   command fibers. Per-command scopes close before suite workspace removal.
6. Let the shared-layer helper close the suite scope after its tests finish.
   Surface cleanup failures and verify cancellation ordering with regressions.

Acquire the shared workspace in the suite layer rather than inside an individual
test's scope. Each test and command has a shorter scope that closes on success,
failure, deadline, or interruption without releasing the suite's workspace.

### Asynchronous commands

Add one command helper using `effect/process/ChildProcess` and
`effect/process/ChildProcessSpawner`, backed by the shared
[`NodeChildProcessSpawner`](https://effect.website/docs/v4/api/platform-node-shared/NodeChildProcessSpawner).

The helper must:

- Accept an executable, argument array, working directory, phase, and deadline.
  Preserve direct execution without shell interpolation.
- Consume stdout and stderr concurrently and await the exit code. A nonzero exit
  must fail even when output collection succeeds.
- Return decoded stdout for existing tar-listing and `"ok"` assertions. Keep
  stderr available for diagnostics without mixing it into stdout.
- Bound buffered output to 1 MiB per stream, matching the existing default
  `execFileSync` buffer limit. Exceeding the limit fails the operation and closes
  the process scope.
- Apply the deadline inside Effect. Configure a bounded termination grace period
  and forced termination for uncooperative processes using the selected adapter's
  supported API. Await process release before returning a timeout failure.
- Keep commands inside the Effect returned to `@effect/vitest`, allowing its
  cancellation bridge to interrupt the running operation. Await process release
  before closing the shared workspace.
- Preserve inherited environment and the selected consumer executable. Retain
  `process.execPath` for TypeScript compilation.

| Operation                 | Command deadline                               | Vitest budget                                                                                      |
| ------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Pack                      | 30 seconds                                     | Outer setup hook: 60 seconds                                                                       |
| Tar listing or extraction | 30 seconds                                     | Explicit 60-second budget for affected tests                                                       |
| npm installation          | Existing 120 seconds                           | Optional-consumer setup: existing 180 seconds                                                      |
| Consumer execution        | Existing 30 seconds                            | Base-consumer test: 120 seconds including extraction; installed optional-consumer test: 60 seconds |
| TypeScript compilation    | Existing 30 seconds                            | Installed runtime/types test: 240 seconds for install, execution, compilation, and cleanup margin  |
| Suite disposal            | Bounded process release and filesystem cleanup | Shared-layer hooks: 60 seconds outer, 180 seconds nested                                           |

Vitest budgets must exceed the operation deadlines and termination grace period
so Effect can finish cleanup before the runner's outer timeout. Verify the
relationship with an actual timeout regression test.

The shared-layer `timeout` applies to both setup and teardown hooks. Setup
commands need their own shorter Effect deadlines because the named layer's setup
hook is not a test callback with a cancellation signal. Avoid relying on a
Vitest hook timeout to terminate a command.

### Errors and filesystem operations

Use a small tagged error union for command failures, command deadlines, output
limits, filesystem failures, and invalid tarball counts. Include the phase
(`pack`, `extract`, `install`, `consumer`, `typecheck`, or `cleanup`) and relevant
paths or command metadata. Command failures retain stdout, stderr, exit status,
and the original cause when available.

Keep Effect error handling inside the harness. At the Effect-aware Vitest
boundary, preserve the failure cause and metadata so test output identifies the
failed operation. Assertion failures continue to use Vitest's normal reporting.

Move smoke-test filesystem operations into Effect helpers. Preserve recursive
directory creation, UTF-8 content, symlink behavior for the existing base
consumers, fixture names, and manifest contents. Join independent file-copy
operations before executing consumers. Keep npm installations and command
sequences sequential; concurrency tuning and retry policies are separate work.

## Implementation sequence

1. Capture the baseline with `npm run validate`, including the six package tests
   and current formatter snapshots. Check the selected package APIs and add
   the four exact development dependencies.
2. Add the source-reference pin and setup command, tool exclusions, root agent
   guidance, language-service configuration, and project-local Zed settings.
   Acquire and verify the reference before authoring the Effect harness.
3. Add the scoped harness and asynchronous command helper. Introduce only the
   service boundary needed to own the shared workspace and supply Node services.
4. Add focused local regression tests before connecting the published-package
   suite, so error and cleanup behavior can be checked without registry access.
5. Move packing from module evaluation into shared-layer acquisition. Migrate
   consumer setup and command execution while retaining all existing assertions
   and the single optional-plugin installation.
6. Remove obsolete lint exceptions and comments caused by replacing synchronous
   commands. Apply necessary exceptions narrowly to the new helper files.
7. Add `check:effect` to full validation and verify it reports a controlled
   floating Effect as an error. Remove the temporary probe afterward. Document
   contributor source setup and Zed usage in the README.
8. Run full validation and minimum-runtime coverage. Verify source setup is
   repeatable and reference files stay outside package checks and the tarball.
   Review dependency, developer-configuration, and package-content diffs.

## Regression coverage

Use `@effect/vitest` live-service tests and real temporary directories. Inject a
failing command or a test spawner at the harness boundary when setup failure
needs to be forced. Use harmless local Node subprocesses for command behavior.
Use a test clock only for isolated Effect logic that does not spawn a process.

| Scenario                               | Evidence required                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| Packing fails after workspace creation | Setup rejects with packing context and the workspace has already been removed   |
| Tarball count is invalid               | Setup reports the count and removes the workspace                               |
| Command exits unsuccessfully           | Failure retains exit status, stdout, stderr, executable, and working directory  |
| Command exceeds its deadline           | Failure identifies the deadline and the child is confirmed terminated           |
| Running command is interrupted         | Process resources are released; suite disposal removes the workspace afterward  |
| Successful shared suite lifecycle      | The workspace remains available across operations and disappears after disposal |

For termination tests, use a readiness handshake and observe child exit. Merely
asserting that a promise rejects does not prove cancellation. Avoid timing-only
sleep assertions. Keep these local regressions free of npm installs and registry
access so they can run in the existing fast `npm test` command.

## Validation and completion criteria

Run focused harness tests during development, then finish with:

```sh
npm run validate
git diff --check
```

`npm run validate` already includes typechecking, ESLint, formatting, unit and
format tests, package smoke tests, Publint, and Are the Types Wrong. Add the
standalone `check:effect` diagnostic command immediately after typechecking.
Inspect the packed manifest to confirm all four Effect-related packages occur
only in development dependencies and the reference checkout is absent.

Run the package suite with an actual Node 22.12.0 consumer executable through
`PRETTIER_CONFIG_CONSUMER_NODE`. The existing minimum-runtime CI job supplies this
executable independently of the development runtime. Retain Node 22, 24, and 26
CI coverage.

The migration is complete when:

- The original six package checks pass with their existing consumer assertions.
- Failure, deadline, interruption, and shared-resource regression tests pass.
- Packing and fixture setup perform no I/O during smoke-test module evaluation.
- The smoke harness uses asynchronous scoped subprocesses throughout.
- Commands stop and release their resources before workspace cleanup completes.
- Published files, runtime imports, public types, and formatter snapshots retain
  their existing contract.
- The dependency lockfile respects the release-age policy and the existing
  contributor runtime floor.
- The source-setup command verifies the pinned commit and release and can run
  twice without changing a valid checkout. Existing dirty or mismatched content
  is preserved with an actionable failure.
- Root agent guidance and contributor documentation identify the reference,
  setup command, version-update procedure, and read-only usage.
- ESLint, formatting, test discovery, TypeScript input, and packed files exclude
  reference sources whether the checkout exists or is absent.
- `check:effect` uses the installed language service without patching TypeScript
  and rejects the controlled floating-Effect probe.
- The Zed settings preserve inherited exclusions and use workspace TypeScript.
  Verify plugin loading through an LSP diagnostic probe or Zed; record whether
  interactive editor behavior was checked.
- Full local validation passes and the existing CI runtime checks pass.

## Source references and Zed setup

The Effect article recommends making library source available to coding agents,
with a read-only reference directory and explicit agent instructions.
[Article](https://effect.website/blog/the-one-weird-git-trick-that-makes-coding-agents-more-effect-ive/)

Include a local reference checkout at `repos/effect`, pinned to the installed
Effect release. Defer a committed Git
subtree: the `effect@4.0.0` tree contains 2,575 files and about 43.8 MB of file
contents, while this repository currently tracks 77 files. Those figures exclude
Git history and installed dependencies.
[Release tree](https://github.com/Effect-TS/effect/tree/67ba4e46a11ccda0b6761578bfd22c04ae00167d)

### Reproducible source checkout

Add `setup:effect-reference`, running
`node scripts/setup-effect-reference.mjs`. Use the Node standard library and Git
so it needs no additional runtime, build step, or compiler patch.

Record the upstream URL, Effect version, release tag, and full commit SHA in
`scripts/effect-reference.json`. For the current `4.0.0` candidate, the tag is
`effect@4.0.0`, resolving to `67ba4e46a11ccda0b6761578bfd22c04ae00167d`.
Recompute the pin if dependency selection chooses another eligible release.

The command must:

- Check that the manifest's version matches the three synchronized Effect
  dependency pins before cloning.
- Use a shallow checkout of the declared release, verify its resolved commit,
  and verify the upstream manifests for core, the shared adapter, and Vitest.
- Clone into a temporary sibling and publish `repos/effect` only after those
  checks pass; clean up an incomplete clone on failure.
- Leave an existing valid, clean checkout unchanged. Fail on a dirty checkout,
  unexpected directory, symlink, or mismatched pin instead of resetting,
  deleting, or overwriting existing content.
- Run only when explicitly invoked. Package installation, `prepare`, validation,
  and CI must not clone reference sources automatically.

Document running the command after contributor installation. When upgrading
Effect, update the dependency pins and reference manifest together. Preserve an
old checkout by moving it aside before rerunning setup for the new pin.

### Agent guidance and tool exclusions

Keep the short source-reference explanation and article link in `AGENTS.md`.
Complete its setup guidance when the checkout command is implemented, directing
agents to explicitly inspect `LLMS.md`, relevant implementations, and tests.
Identify the
Scope/Layer, process-spawner, and Vitest code relevant to this harness. Agents
must treat the checkout as read-only, use normal npm imports, and verify the
reference pin before applying examples. If absent, run the documented setup
command before working on Effect-specific changes.

Keep `repos/` out of Git, ESLint, Prettier, TypeScript project input, Vitest test
discovery, and normal staged-file tasks. Restrict Vitest's test inclusion to
`tests/**/*.test.ts`, retaining default exclusions and excluding formatting
fixtures. Git ignore alone is not a guarantee that every tool excludes a
directory. Run full validation with the reference present, then compare test
discovery and lint/format exclusions with it temporarily moved aside. Existing
CI runs validate the normal installation without a source checkout.

Editor index exclusions also remove reference files from indexed search. Verify
the chosen coding agent can read the pinned source through direct filesystem
access and its documented instructions.

### Zed editor configuration

Zed uses `vtsls` for JavaScript and TypeScript by default. The implemented
`.zed/settings.json` hides the reference directory from its project tree, file
scans, and searches, and separately excludes it from TS/JS auto-imports:

```json
{
  "file_scan_exclusions": ["**/repos", "..."],
  "lsp": {
    "vtsls": {
      "settings": {
        "vtsls": {
          "autoUseWorkspaceTsdk": true
        },
        "typescript": {
          "preferences": {
            "autoImportFileExcludePatterns": ["**/repos/**"]
          }
        },
        "javascript": {
          "preferences": {
            "autoImportFileExcludePatterns": ["**/repos/**"]
          }
        }
      }
    }
  }
}
```

`"..."` preserves inherited file exclusions. File scanning and LSP preferences
are separate controls; this does not guarantee that every language-server
watcher ignores the reference. Confirm watcher behavior separately if needed.
[Zed settings](https://zed.dev/docs/reference/all-settings#file-scan-exclusions),
[Zed TypeScript support](https://zed.dev/docs/languages/typescript),
[vtsls preferences](https://github.com/yioneko/vtsls/blob/main/packages/service/configuration.schema.json)

### Language-service diagnostics

Install `@effect/language-service` locally and append its registration to
`compilerOptions.plugins`, preserving the existing compiler settings:

```json
{
  "name": "@effect/language-service",
  "diagnosticSeverity": {
    "floatingEffect": "error"
  }
}
```

Use workspace TypeScript through `vtsls.autoUseWorkspaceTsdk`, as above. Verify
the selected plugin release loads and reports a controlled floating-Effect
diagnostic through `vtsls` or Zed. Do not change global user editor settings.
[vtsls plugin setup](https://github.com/yioneko/vtsls#typescript-plugin-not-activated)

Add `check:effect` with
`effect-language-service diagnostics --project tsconfig.json` and include it in
`validate` after normal typechecking. Verify the pinned CLI reports a nonzero
status for the error probe and succeeds after its removal. Register the plugin
in the project config so editor and CLI diagnostics share the same settings.
Use the standalone CLI without patching TypeScript or modifying the existing
Husky `prepare` script. Editor plugins alone do not add diagnostics to plain
`tsc`.
[Language-service CLI](https://github.com/Effect-TS/language-service#effect-language-service-cli)

The VS Code DevTools extension remains outside the preferred Zed workflow.
The source checkout, editor configuration, diagnostics, and completed setup
guidance are implementation deliverables. The short article reference and
read-only policy are already documented in `AGENTS.md`.

## Review considerations

Some v4 platform and Vitest APIs are marked unstable. Pin exact versions and
verify their exports and termination behavior against the installed release,
particularly when the documentation describes a newer patch or release candidate.

Scoped cleanup covers normal completion, failure, and cooperative interruption;
forced termination of the parent process can still prevent finalizers from
running. The acceptance criteria concern observable cleanup during the test
runner's supported lifecycle.

Review the implementation for the concrete cleanup and diagnostic improvements.
Keep the harness small enough that its additional runtime and layer concepts
remain justified by those improvements.

## Implementation verification

Verified on 2026-10-09:

- `npm run validate` passed with 78 unit/format tests (including ten new harness
  regressions), six package smoke tests, zero Effect diagnostics, strict
  Publint, and Are the Types Wrong under the existing ESM profile.
- All six package checks passed using an actual Node 22.12.0 consumer executable
  while development tools ran on Node 24.21.0.
- A temporary floating-Effect probe made `check:effect` exit with status 1.
  Zed's installed `vtsls@0.3.0`, using the project settings, reported the same
  diagnostic with error severity. The probe was removed. Interactive Zed UI
  behavior was not exercised.
- Reference setup was checked for repeatability, preservation of dirty and
  mismatched checkouts, symlink refusal, incomplete-clone cleanup, and dependency
  pin mismatch. Refusal checks used isolated fixtures.
- ESLint inputs, TypeScript inputs, and Vitest discovery were identical with the
  checkout present and temporarily absent; Prettier ignored the reference in
  both cases. Validation passed with the checkout present.
- The packed package retains exactly the five required files. Effect packages
  occur only in development dependencies. Runtime configuration, declarations,
  consumer programs, formatting fixtures/snapshots, and CI workflows have no
  changes.

CI runtime results are tracked on the implementation pull request.
