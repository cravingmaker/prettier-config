# Codebase improvement implementation plan

Status: implementation in progress; see the completion checklist and evidence below.

Audit date: 2026-10-10. Baseline: `2317114230b0fcf95843e9db263875817ebbb8dd`
(`@cravingmaker/prettier-config` 0.3.2).

## Objective and scope

Make routine agent changes easier to implement correctly and make mistakes fail
early with actionable diagnostics. Strengthen the existing runtime, typing,
tests, documentation, and CI without adding unnecessary architecture.

Implementation is delivered as focused, dependent PRs. Checklist entries are
marked complete only after their acceptance criteria have been demonstrated.

## Implementation decisions and evidence

- Delivery prerequisite: CI and Dependency Review now accept PRs targeting
  feature branches as well as `main`. The previous `main`-only event filters
  prevented remote validation of stacked PRs. This small trigger change comes
  before Stage 9; required job names, commands, and repository rules are retained.
- CI baseline (PR #122, run `38013060607`): Node 22 took 53 seconds, Node 24
  and 26 each took 50 seconds, and minimum Node 22.12.0 took 32 seconds.
  Each Node matrix job performed full validation and two npm consumer installs;
  the minimum-runtime job performed two more. Stage 9 will compare these owners
  and installation counts with the proposed workflow.
- Stage 1: `tests/consumers/resolution.mjs` reproduced the no-entry-point defect
  before the fix. It now checks confirmed absence and five broken-installation
  cases for all three optional names against the npm-installed tarball, in fresh
  Node processes to avoid package-metadata caching. Mocked tests still check
  original error identity. Full validation passed (84 regular tests, six package
  checks), as did all six consumer checks on Node 22.12.0. Snapshots, plugin
  ordering, runtime dependencies, and the five-file tarball are unchanged.
- Stage 2: six tooling regressions failed before the change and now pass.
  JavaScript uses typed promise/unsafe-value rules with project service; new
  scripts are compiler inputs. The runtime checks the required shape from the
  explicitly resolved `index.d.ts`. Five schema regressions cover external JSON
  boundaries with file/phase diagnostics. `typescript-eslint` 8.59.2 is declared
  directly (matching the existing lint config dependency; published 2026-05-04).
  Full validation passed (95 regular tests, six package checks), including
  installed public-type extension/spread checks and unchanged package contents.
- Stage 3: 18 negative cases failed before the new rule. Thirty additional
  tooling checks now demonstrate path/symbol/module enforcement, aliases,
  destructuring, literal computed access, re-exports, reference exclusions, stable
  positive cases, and an actual `floatingEffect` CLI failure. The rule consults
  attached documentation in installed declarations and never scans whole mixed
  modules or reads `repos/`. `@typescript-eslint/utils` 8.59.3 is now a direct
  development dependency, preserving the previously installed version and
  lockfile tree. Full validation passed (125 regular tests, six package checks).
  Enforcement decision: CommonJS Effect loads are rejected at the loading
  boundary because Node's `Require` returns `any`; typed ESM imports retain
  stability information. Nonliteral module loading is also rejected because its
  target cannot be established. Arbitrary runtime indirection is not claimed to
  be statically verified.
- Stage 4: the new offline command validates all three exact dependency pins,
  root declarations and installed lockfile records, tag/version agreement, and
  commit format before full validation. A regression demonstrated that the old
  `validate` accepted drift. Twenty-four disposable-project tests now cover
  metadata failures, offline operation without `repos/`, checkout preservation,
  symlink refusal, and failed-clone/verification cleanup. The real reference was
  left untouched. Dependabot groups the coordinated packages. Full validation
  passed (150 regular tests, six package checks), with actionlint and diff checks.
  A decoded-record regression exposed a Stage 3 false positive: computed access
  on data is now permitted, while computed Effect namespace access still fails.
  The rule's cold project initialization has an explicit 15-second test budget;
  its diagnostic assertions are unchanged.
  The pre-push hook exposed inherited Git repository variables affecting fixture
  commands. Those accidental local Git changes were restored before delivery.
  Setup and fixture commands now clear Git's own `--local-env-vars` list for
  foreign repositories, following the Git hook documentation. A dedicated
  regression supplies repository/index variables and verifies source preservation;
  the enabled pre-push hook also exercises this environment.
- Stage 5: the executable fixture moved to `tests/consumers/installed.mjs`; a
  typed-lint regression failed before the move and now checks its promise/unsafe
  rules. Both suites reuse a single scoped npm installation. The extracted
  tarball/dependency-symlink path and redundant base program/list were removed
  after the assertion inventory below passed. Required string plugins and the
  object-valued Oxc plugin are verified against consumer-local installations.
  Full validation passed (151 regular tests, six package checks); all six
  consumer checks also passed on Node 22.12.0, and all 16 lifecycle regressions
  passed. Public type compilation and the five-file tarball check remain separate.
- Stage 6: concise agent guidance maps repository ownership and preserved
  contracts; `docs/architecture.md` explains runtime/types, installed consumers,
  stable Effect scopes, native processes, and six change recipes. Contributor
  setup includes explicit hook activation, live clocks, minimum/development Node,
  source-pin updates, and intentional snapshot review. README keeps consumer
  instructions and links contributor details. Local paths/anchors and command
  names were reviewed; documentation lint/format, diff checks, and full validation
  passed (151 regular tests, six package checks). Stages 7–9 are labeled pending
  in the guide until their implementations and remote checks are demonstrated.
- Stage 7 implementation: fifteen lint negatives failed before enforcement;
  ordinary/named-alias/each tests, Effect live/effect testers, typed tester aliases,
  layer helpers, conditional/pending modes, and invalid assertions are now guarded.
  Six positives include unrelated objects and an explained local exception. A
  real local Vitest invocation accepted focus before `allowOnly: false` and now
  rejects it. The pinned Vitest plugin is 1.6.27 (published 2026-08-10, compatible
  declared peers). Its built-in chains omit Effect helpers, so a typed local rule
  supplements them without excluding Effect tests. Actionlint 1.7.12 (released
  2026-03-30) uses verified archive/binary pins and a checked cache, with four
  regressions for version, invalid expressions, and altered cache preservation.
  Full validation passed (177 regular tests, six package checks), including the
  pinned workflow command. All remote required checks passed on PR #131 (CI run
  `38017791451`), including the pinned workflow gate in Node 22/24/26 validation
  and minimum Node 22.12.0 consumers. The stack preserves the subsequent main
  merges; refreshed branch histories have identical source trees.
- Stage 8 implementation: the minimum-peer scenario first exposed the old fixed
  Prettier installation (3.9.9 instead of 3.9.8). Installations now select exact
  current or declared-minimum peers from one definition; runtime programs assert
  the selected Prettier version. The optional consumer explicitly installs
  Tailwind CSS 4.1.14 (published 2025-10-01) and retains Svelte. Two additional
  checks cover a relative Tailwind v4 stylesheet from normal/external directories,
  observable custom theme/utility sorting versus a control, defaults, and
  idempotence. The same two npm installations cover all eight package checks.
  Minimum-peer and macOS lifecycle jobs supplement the retained Linux matrix and
  separate Node 22.12.0 consumer job. Windows execution remains unverified.
  Full local validation passed (177 regular tests, eight package checks), as did
  all eight minimum-peer checks on Node 22.12.0, all 16 macOS lifecycle tests,
  pinned actionlint, and diff checks. All remote checks passed on PR #134 (CI run
  `38018674182`): Linux Node 22/24/26, consumer Node 22.12.0, eight minimum-peer
  checks, 16 macOS lifecycle tests, and Dependency Review. The existing Linux
  lifecycle coverage also passed in the full Node suites. Stage 8 is complete.

## Verified baseline

The audit inspected the runtime, declarations, tooling, consumer programs,
fixtures, process harness, documentation, workflows, and effective ESLint and
TypeScript configuration. It also exercised deliberately invalid code in memory
and reproduced optional-plugin resolution behavior in disposable directories.

- `npm run validate` passed: 84 unit/integration tests, six package tests,
  TypeScript, Effect diagnostics, ESLint, formatting, Publint, and ATTW's ESM
  profile.
- `actionlint` and `git diff --check` passed.
- `npm audit --omit=dev` reported zero vulnerabilities at the audit date.
- Local execution used macOS, Node.js 24.21.0, and npm 11.19.0. Other runtime and
  operating-system combinations were not executed locally during the audit.
- The effective `main` rules require `Node.js 22`, `Node.js 24`, `Node.js 26`,
  `Minimum Node.js 22.12.0`, and `Dependency Review`, with up-to-date status
  checks. This is configuration evidence, not a claim that new PR checks passed.
- The Effect dependency versions and source-reference pin currently agree.

Passing checks coexist with the gaps below. The acceptance criteria deliberately
exercise failure cases that the baseline checks do not reject.

## Architecture and contracts to preserve

| Area                  | Ownership and contract                                                                                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Published runtime     | `index.mjs` remains the directly published ESM configuration, with no compilation step.                                                                                      |
| Public types          | `index.d.ts` describes the runtime and guarantees that `overrides`, `plugins`, and `singleAttributePerLine` are present.                                                     |
| Repository formatting | `prettier.config.mjs` re-exports the published configuration.                                                                                                                |
| Package contents      | Keep the five-file tarball contract: runtime, declaration, package manifest, README, and LICENSE. Development tools remain development dependencies.                         |
| Formatting behavior   | Preserve Prettier defaults plus `singleAttributePerLine`, the separate Oxc JavaScript/TypeScript overrides, absolute plugin paths, and Tailwind-last ordering.               |
| Compatibility         | Preserve Node.js 22.12.0 for consumers, the separate development runtime requirement, and declared peer ranges unless a separately justified compatibility change is needed. |
| Harness               | Effect owns resource lifetimes, typed failures, deadlines, and interruption; `tests/helpers/node-command.ts` owns native process events and mutable buffers.                 |
| Consumers             | Checked-in ESM programs execute against actual packed installations and consumer-local dependencies, including from an external working directory.                           |
| Source references     | `repos/` is read-only reference material, ignored by tooling and never imported as an application dependency.                                                                |
| Tests and snapshots   | Preserve existing behavioral assertions, intentional raw fixtures, and reviewed snapshots. Do not update snapshots merely to make a refactor pass.                           |

Before writing Effect code, run `npm run setup:effect-reference`, read
`repos/effect/LLMS.md`, and inspect the relevant pinned source, examples, and
tests. Repository requirements for public, stable APIs take precedence over
upstream examples that use unstable modules or symbols.

## Delivery order

The stage numbers retain the audit recommendation numbers. Each stage can use
more than one PR when separating concerns makes review easier.

| Stage | Priority | Dependencies                                                      | Intended result                                                                                 |
| ----- | -------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1     | High     | None                                                              | Broken optional installations fail visibly.                                                     |
| 2     | High     | None                                                              | Owned JavaScript receives typed linting and public types stay connected to the implementation.  |
| 3     | High     | Stage 2                                                           | Effect stability rules reject unsupported import forms and symbols.                             |
| 4     | Medium   | Stage 2                                                           | Effect dependencies and reference metadata cannot drift silently.                               |
| 5     | Medium   | Stages 1 and 2                                                    | Executable consumer checks have one checked, npm-installed path.                                |
| 6     | Medium   | Initial guidance can start immediately; finalize after Stages 2–5 | Agents can find ownership, invariants, and the right change procedure.                          |
| 7     | Medium   | Stages 2 and 3 for shared guardrail test conventions              | Test and workflow mistakes fail locally and in CI.                                              |
| 8     | Medium   | Stage 5                                                           | Minimum peers, Tailwind stylesheet behavior, and macOS lifecycle behavior have direct coverage. |
| 9     | Lower    | Stages 3, 4, 7, and 8                                             | CI avoids duplicated static checks while preserving all required gates.                         |

## Stage 1: distinguish missing optional plugins from broken installations

**Finding.** `resolveOptionalPlugin` currently suppresses `MODULE_NOT_FOUND`
without a `path` property. An installed Tailwind package containing a manifest
but no entry point produces that shape too. The audit reproduced a successful
configuration import followed by unsorted `class="p-4 flex"` output.

**Files:** [index.mjs](index.mjs), [tests/config.test.ts](tests/config.test.ts),
and a focused resolution regression test if real filesystem cases need a
separate test file.

Implementation:

1. Reproduce genuinely absent packages, installed packages with no entry point,
   missing `main` targets, and missing `exports` targets using real temporary
   package directories. Retain the existing mocked error-propagation tests.
2. Inspect resolution behavior on the minimum supported Node runtime. Add the
   smallest reliable package-presence check around failed optional resolution.
   Do not infer absence from one error property or assume a package exports its
   `package.json` subpath.
3. Suppress confirmed absence only. Preserve the original error for broken
   metadata, inaccessible exports, missing installed entry points, permission
   failures, and other unexpected resolution failures.
4. Keep resolution relative to the installed configuration, preserve plugin
   order, and avoid extra work on the successful resolution path.

Acceptance:

- Missing optional plugins remain supported; mandatory plugins still resolve.
- Broken installed optional plugins fail configuration loading rather than
  silently disabling formatting features.
- Resolution regressions cover all three optional plugin names.
- Existing snapshots and normal/external-directory consumers remain unchanged.
- Minimum-runtime package tests pass with the new resolution cases included.

Validation: focused resolution tests, `npm test`, `npm run test:package`, then
`npm run validate`. Use the existing minimum-runtime CI strategy for Node 22.12.0.

## Stage 2: close JavaScript typing gaps and connect the public contract

**Finding.** JavaScript has `checkJs` but lacks the typed ESLint rules applied to
TypeScript. Unawaited filesystem work and unsafe operations on `JSON.parse()`
results passed both baseline checks. `tsconfig.json` names only the current
setup script and does not include `eslint.config.js`.

**Files:** [eslint.config.js](eslint.config.js), [tsconfig.json](tsconfig.json),
[index.mjs](index.mjs), [index.d.ts](index.d.ts),
[scripts/setup-effect-reference.mjs](scripts/setup-effect-reference.mjs),
[package.json](package.json), `package-lock.json`, consumer type fixtures, and
focused tooling regression tests.

Implementation:

1. Add a local typed JavaScript override using `typescript-eslint` and
   `projectService`, with a direct development dependency if importing its API.
   Reuse the repository's compiler configuration and strict settings.
2. Apply the override to owned configuration, script, and consumer JavaScript.
   Start with promise correctness and `no-unsafe-*` rules; retain ordinary
   JavaScript linting and keep necessary exceptions narrow and explained.
3. Include `eslint.config.js` and `scripts/**/*.mjs` in TypeScript inputs. Keep
   raw formatting fixtures and `repos/` excluded. Stage 5 moves the executable
   consumer fixture into checked code; its consumer-only type fixture continues
   to be compiled by the installed-consumer test.
4. Decode external manifest data from `unknown` with stable Effect Schema APIs
   in development tooling. Report malformed data with file and phase context.
   Do not introduce a schema dependency into the published runtime.
5. Use the declaration's required public configuration shape as the runtime's
   JSDoc contract, keeping its definition in the existing declaration file.
   Verify the actual module resolution used for this relationship. The public
   `Config` type can remain broader than the implementation's inferred literals.
6. Retain positive consumer extension tests and negative type assertions. Cover
   required properties without adding a declaration-generation build step.

Acceptance:

- An unawaited filesystem operation and unsafe parsed-data access produce typed
  ESLint errors in owned `.mjs` files.
- Newly added scripts receive typechecking without manually editing a file list.
- A deliberately incompatible runtime/public type shape fails typechecking.
- Valid declaration extensions and required-array spreads still compile.
- The five-file package contents and runtime dependency list remain unchanged.

Validation: focused ESLint/TypeScript negative cases, `npm run typecheck`,
`npm run lint`, `npm run typecheck:package`, and `npm run validate`.

## Stage 3: enforce the Effect API policy and test its enforcement

**Finding.** Static restrictions reject known process imports, but a dynamic
import of `effect/process/ChildProcess` passes ESLint. `Schema.MacAddress`, marked
unstable in the pinned source, also passes ESLint and TypeScript through the
ordinary `effect` module.

**Files:** `eslint.config.js`, a small local lint rule module under `scripts/`
if needed, a focused `tests/tooling-guards.test.ts`, and the development guide.

Implementation:

1. Extend restrictions to static imports, re-exports, literal dynamic imports,
   and applicable CommonJS forms. Keep supported stable imports available.
2. Add a focused typed rule that follows symbol aliases and checks attached
   module/symbol documentation for `@stability unstable` or explicit experimental
   annotations. Verify behavior against the pinned checkout and installed
   declarations. Do not classify an entire mixed-stability module by searching
   all of its text for the word `unstable`.
3. Cover named imports, namespace/member access, re-exports, and literal computed
   property access. Reject nonliteral Effect loading where static enforcement
   cannot establish the target; avoid claiming arbitrary runtime indirection is
   statically proven safe.
4. Assert that reference-source imports are rejected, while `repos/` itself
   remains excluded from linting and typechecking.
5. Add positive and negative rule tests using in-memory source or disposable
   projects. Assert rule identifiers and diagnostics, not only aggregate counts.
   Include the existing `floatingEffect` diagnostic in the guardrail checks.
6. Ensure checks work without a cloned `repos/effect`; the reference is required
   for authoring and verification, not for ordinary CI execution.

Acceptance:

- Known unstable paths and symbols fail across the supported import/access forms.
- Stable APIs currently used by the harness pass without blanket suppressions.
- Tests detect disabled restrictions, an unobserved Effect, and reference imports.
- Failure messages identify the API and explain the permitted alternative or
  required stability review.

Validation: rule tests, Effect diagnostic regression, `npm run check:effect`,
`npm run lint`, and `npm run validate`, with reference discovery excluded.

## Stage 4: prevent Effect reference drift

**Finding.** Dependency/reference consistency is checked only during explicit
setup. Validation does not enforce it, and Dependabot does not group the three
coordinated package updates.

**Files:** `scripts/setup-effect-reference.mjs`,
[scripts/effect-reference.json](scripts/effect-reference.json), a proposed
`scripts/check-effect-reference.mjs`, a shared metadata validator if needed,
[.github/dependabot.yml](.github/dependabot.yml), `package.json`, and script tests.

Implementation:

1. Extract reusable metadata validation and add a read-only, offline
   `check:effect-reference` command to `validate`.
2. Check exact versions for `effect`, `@effect/platform-node-shared`, and
   `@effect/vitest` against reference metadata and root lockfile records. Validate
   the tag/version relationship and commit format. The setup command remains
   responsible for verifying the actual remote commit and checkout contents.
3. Group those three Dependabot packages; keep the independently versioned
   language service separate. Explain that reference metadata must accompany
   grouped version updates.
4. Exercise mismatched pins, invalid metadata, dirty/mismatched checkouts,
   symlinks, and failed setup cleanup using disposable local repositories or
   controlled process substitutes. Never modify the real reference checkout.

Acceptance:

- An inconsistent dependency, lockfile, or reference version fails `validate`.
- Consistent metadata passes offline with `repos/effect` absent.
- Routine validation neither clones nor modifies reference repositories.
- Setup preserves unexpected user content and reports an actionable failure.

Validation: focused script tests, the new offline command, formatting/linting,
and `npm run validate`.

## Stage 5: consolidate installed-consumer tests

Delivered assertion inventory:

| Former assertion                                                                | Checked replacement                                                                                         |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Base JavaScript/TypeScript, package.json ordering, full TOML, and XML output    | Exact outputs in `tests/consumers/installed.mjs`                                                            |
| Installed fixture TSX, JSON, YAML, and minimal TOML output                      | Exact outputs retained alongside the base cases                                                             |
| Parser selection, single-attribute option, default print width, and idempotence | `tests/consumers/helpers.mjs`, used by both consumer programs                                               |
| Plugin provenance and optional absence                                          | Shared real-path checks, Oxc object identity, and base optional-name assertions                             |
| External working directory, installed public types, and package contents        | Shared npm base/optional layers, both working directories, independent type compilation and tarball listing |

**Finding.** `tests/fixtures/installed-consumer/check.mjs` is executable test
support but is excluded from repository linting and typechecking. It overlaps
with `tests/consumers/base.mjs`; base scenarios also retain a separate tarball
extraction and dependency-symlinking path.

**Files:** [tests/package.smoke.test.ts](tests/package.smoke.test.ts),
[tests/helpers/package-smoke.ts](tests/helpers/package-smoke.ts),
[tests/consumers/](tests/consumers/),
[tests/fixtures/installed-consumer/](tests/fixtures/installed-consumer/), and
tooling inputs where needed.

Implementation:

1. Move `tests/fixtures/installed-consumer/check.mjs` to
   `tests/consumers/installed.mjs`. Keep raw formatter inputs and the intentional
   consumer-only type fixture distinct from executable support code.
2. Inventory assertions in both base programs. Consolidate them into the moved
   program and shared helpers, including plugin provenance, optional absence,
   parser selection, default options, output, and idempotence.
3. Create one scoped npm-installed base consumer and retain one scoped
   npm-installed optional consumer. Reuse each installation across applicable
   scenarios; share expensive resources at the suite layer.
4. Run base and optional programs from normal and external working directories.
   Keep type compilation on the development runtime and consumer execution
   controlled by `PRETTIER_CONFIG_CONSUMER_NODE`.
5. After coverage parity is demonstrated, remove `base.mjs`, `createConsumer`,
   the dependency-symlinking path, and its redundant required-dependency list.
   Preserve independent tarball-content and public-type checks.
6. Retain cleanup on failure, deadline, and interruption. Use live clocks for
   real subprocess deadlines and continue using the native process adapter.

Acceptance:

- All former base assertions are accounted for and retained or strengthened.
- Executable consumer programs are linted and typechecked.
- Consumer packages and dependencies come from npm installation, with plugin
  paths verified inside that installation.
- Base and optional installations are each created once per selected scenario
  set, and all workspaces are removed after use.
- Node 22.12.0 consumer execution and existing lifecycle regressions still pass.

Validation: targeted consumer checks, lifecycle tests, `npm run test:package`,
the minimum-runtime CI job, and `npm run validate`.

## Stage 6: document ownership, invariants, and change procedures

**Finding.** `AGENTS.md` concentrates on Effect. Broader package contracts and
change procedures require reading several files and inferring their relationship.

**Files:** [AGENTS.md](AGENTS.md), [CONTRIBUTING.md](CONTRIBUTING.md),
[README.md](README.md), and a new `docs/architecture.md`.

Implementation:

1. Keep `AGENTS.md` short: repository map, important invariants, canonical checks,
   and links to detailed guidance.
2. Explain runtime, public declarations, consumer execution, Effect scopes, and
   native process ownership in `docs/architecture.md`. Record why the runtime is
   published directly and why process execution uses the native adapter.
3. Add change recipes for plugin updates, formatter behavior, public types,
   subprocess lifecycle, dependency/reference updates, and CI changes. Each
   recipe names affected contracts and the smallest relevant checks followed by
   full validation before a PR.
4. Document npm installation, explicit hook activation, minimum/development
   runtime differences, live process clocks, and intentional snapshot updates.
5. Keep consumer instructions in README and contributor detail in CONTRIBUTING
   and the architecture guide. Link shared guidance instead of duplicating it.

Acceptance: an agent can identify where a change belongs, what must remain true,
and how to prove it using repository documentation. Commands and paths match the
implemented state; future stages are labeled as planned until delivered.

Validation: documentation lint/format checks, local link and command review, and
`npm run validate` before the documentation PR.

## Stage 7: add test and workflow guardrails

**Finding.** Focused and skipped tests pass current ESLint checks. Vitest rejects
focused tests by default in CI but permits them locally. Workflow YAML is not
semantically checked by the repository's lint command.

**Files:** `eslint.config.js`, [vitest.config.ts](vitest.config.ts),
`package.json`, `package-lock.json`, `.github/workflows/ci.yml`, tooling
regression tests, and contributor documentation.

Implementation:

1. Add `@vitest/eslint-plugin` as a pinned development dependency. Enable focused
   and disabled-test detection and assertion-correctness rules. Require a local,
   explained exception for intentionally disabled tests.
2. Verify detection for ordinary Vitest tests, aliases, `.each`, and the actual
   `@effect/vitest` forms (`it.effect`, `it.live`, and layer-provided helpers).
   Configure or narrowly supplement unsupported forms rather than assuming the
   plugin recognizes them.
3. Set `allowOnly: false` explicitly so ordinary local validation rejects focused
   tests too. Preserve explicit file/name filtering for development workflows.
4. Run a pinned actionlint binary in CI. Provide a documented local workflow
   check and installation method; do not make repository validation depend on an
   undocumented global binary. Pin any added GitHub Action by commit.
5. Test representative invalid workflow expressions and test constructs through
   the configured tools without committing broken workflows or skipped tests.

Acceptance: accidental focused/disabled tests and invalid assertions fail the
appropriate checks; malformed workflow configuration fails the workflow gate;
existing Effect tests pass without broad rule exclusions.

Validation: guardrail tests, `npm run lint`, `npm test`, actionlint, and
`npm run validate`; verify the workflow gate on the PR.

## Stage 8: cover declared compatibility and platform behavior

**Finding.** Installed consumers always use development Prettier 3.9.9 while the
peer range permits 3.9.8. The documented custom Tailwind stylesheet path lacks a
direct consumer test. Process lifecycle CI currently runs only on Linux.

**Files:** `tests/helpers/package-smoke.ts`, `tests/package.smoke.test.ts`,
consumer programs and Tailwind fixtures, `.github/workflows/ci.yml`, and relevant
compatibility documentation.

Implementation:

1. Parameterize the consumer installation's Prettier version. Define current and
   minimum peer scenarios once, verify the installed version, and keep the
   minimum scenario aligned with the declared range.
2. Exercise required and optional plugin behavior at the lower bound. Run this
   targeted scenario once in CI rather than multiplying every peer combination
   across every Node version.
3. Add a Tailwind v4 stylesheet with a custom theme/utility and a configuration
   using a relative `tailwindStylesheet` path. Assert observable custom sorting,
   ordinary formatting, and idempotence from normal and external directories.
   Keep required consumer packages explicit.
4. Add a macOS lifecycle job for process-tree termination, interruption,
   deadlines, output limits, and path handling. Retain Linux execution.
5. Keep minimum Node execution separate from development tools. Treat Windows
   execution as unverified unless separately exercised; this stage does not
   remove the existing Windows adapter path or claim new platform support.

Acceptance: minimum peers and custom stylesheet behavior have observable
assertions, macOS/Linux lifecycle tests pass, and Node 22.12.0 remains covered.
Investigate incompatibilities before considering any separate peer-range change.

Validation: selected peer scenarios, custom Tailwind consumer tests, lifecycle
tests on both operating systems, minimum-runtime CI, and `npm run validate`.

## Stage 9: reduce duplicated CI work without weakening merge gates

**Finding.** Each Node matrix job runs all static, formatting, behavioral, and
package checks. Several static checks repeat work that can have one required
owner.

**Files:** `.github/workflows/ci.yml`, `package.json`, contributor documentation,
and coordinated repository rules if a required status context changes.

Implementation:

1. Record the current job durations and map every existing/new command to its
   owning CI job before changing the workflow.
2. Run repository typechecking, Effect checks, ESLint, formatting, workflow lint,
   and package static analysis once on the development runtime. Retain
   version-sensitive behavior and installed-consumer execution on Node 22/24/26,
   minimum Node 22.12.0 execution, minimum-peer coverage, and macOS lifecycle
   coverage.
3. Keep `npm run validate` as the complete local and publishing entry point.
   Separate composable scripts only where CI needs them; do not silently remove
   a check from local or release validation.
4. Preserve the existing required Node job names and make their success depend
   on the shared checks. Skipped or failed prerequisite jobs must not produce a
   misleading successful required status. Use an explicit result gate where
   needed and verify the actual GitHub behavior.
5. If required contexts must change, keep the old gates effective until the new
   checks and repository rules are coordinated. Do not merge a workflow change
   that leaves required checks permanently pending or bypasses validation.
6. Compare durations and registry-install counts with the baseline. Retain an
   optimization only when it removes duplicated work without losing coverage.

Acceptance: every check has an explicit owner; a deliberate shared-check failure
blocks merge; all required statuses still settle correctly; local and publishing
validation remain complete.

Validation: actionlint, command-coverage review, `npm run validate`, a controlled
failure-path verification, and successful required checks on the proposed CI PR.

## Dependency and file decisions

| Item                              | Planned decision                                                                                                                                         |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `typescript-eslint`               | Declare directly as a development dependency when the local configuration imports its typed-linting API.                                                 |
| `@vitest/eslint-plugin`           | Add as a development dependency after verifying the chosen release against the installed ESLint, TypeScript, Vitest, and Effect test forms.              |
| actionlint                        | Add pinned CI tooling and a reproducible local invocation. It is not a runtime dependency.                                                               |
| Effect Schema                     | Reuse stable APIs for external data validation in development tooling.                                                                                   |
| Zod                               | Do not add for this plan; the existing schema facilities cover the identified boundary.                                                                  |
| Runtime layout                    | Keep `index.mjs` and `index.d.ts` at the root, with the current export paths and no build output.                                                        |
| Consumer layout                   | Move the executable installed-consumer check into `tests/consumers/`; remove duplicate code only after coverage parity.                                  |
| Architecture documentation        | Add `docs/architecture.md`; keep concise entry-point guidance in `AGENTS.md`.                                                                            |
| Other libraries and broad cleanup | Defer unused-code scanners, dependency-graph frameworks, broad file renames, and unrelated dependency remediation until a concrete need is demonstrated. |

Use npm and exact versions. Recheck compatibility and publication dates when
implementing dependency additions, respecting `.npmrc`'s release-age and
installation-script policies. Do not rely on an undeclared transitive package or
change the registry trust/publishing configuration as part of these improvements.

## Completion and review requirements

For each implementation PR:

1. Recheck the relevant finding against current `main`; preserve intervening
   behavior changes and adjust stale assumptions explicitly.
2. Add a meaningful regression that demonstrates the original failure or missing
   guard before changing the behavior. Documentation-only work needs no new test.
3. Keep the diff focused. Record file moves and assertion parity when removing
   old test support. Include before/after output for intentional formatting
   changes and preserve unrelated snapshots.
4. Run targeted checks first, then `npm run validate` and `git diff --check`.
   Run actionlint for workflow changes. Report local results separately from
   remote CI, network limitations, or untested platforms.
5. Verify the package's export/type resolution and tarball contents after changes
   affecting runtime, declarations, dependency boundaries, or consumer tests.
6. Update the implemented guidance and mark only completed stages in this plan.
   Keep any unfinished portion explicitly pending.

Revert an individual stage if it weakens a package contract or produces noisy,
unreliable enforcement. Do not recover passing checks by globally disabling a
guard, weakening assertions, widening peer ranges, or rewriting snapshots.

## Completion checklist

- [x] Stage 1: optional-plugin resolution defect fixed and regression covered.
- [x] Stage 2: JavaScript typed linting and public contract checks enforced.
- [x] Stage 3: Effect stability and import guardrails tested.
- [x] Stage 4: offline dependency/reference consistency enforced.
- [x] Stage 5: consumer programs consolidated and checked.
- [x] Stage 6: agent guidance and architecture/change documentation delivered.
- [x] Stage 7: test and workflow guardrails enforced.
- [x] Stage 8: minimum-peer, custom Tailwind, and macOS coverage delivered.
- [ ] Stage 9: CI duplication reduced with required gates verified.

## References

- [Typed linting with Project Service](https://typescript-eslint.io/blog/project-service/)
- [ESLint static import restrictions and their limitations](https://eslint.org/docs/latest/rules/no-restricted-imports)
- [Vitest ESLint plugin](https://github.com/vitest-dev/eslint-plugin-vitest)
- [Vitest `allowOnly` behavior](https://vitest.dev/config/allowonly)
- [actionlint workflow checks](https://github.com/rhysd/actionlint)
- [Repository development guide](README.md#development)
- [Contribution and release requirements](CONTRIBUTING.md)
