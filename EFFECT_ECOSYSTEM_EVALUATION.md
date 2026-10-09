# Effect v4 ecosystem evaluation

Date: 2026-10-09

Status: evaluated and implemented for the four selected development packages.
The broader package verdicts remain an assessment.

## Recommendation

Use four exact development dependencies for the smoke harness: `effect`,
`@effect/platform-node-shared`, `@effect/vitest`, and `@effect/language-service`.

Include the language service for editor and CLI diagnostics, with a pinned local
source reference, agent guidance, and project-local Zed settings.
`@effect/doctest` is a future candidate if executable
README examples become a separate goal. For the preferred Zed workflow, use
Effect logging and ordinary Node/Vitest debugging before adding a dedicated
DevTools UI. Documentation tests and a dedicated DevTools UI remain future work.

The [implementation plan](./IMPLEMENTATION_PLAN.md) includes all four dependencies,
the shared-layer lifecycle, source setup, Zed configuration, and diagnostic checks.

## Scope and evidence

Reviewed all 32 public package manifests and seven private tooling manifests in
the official v4 monorepo at
[commit 7ff5048](https://github.com/Effect-TS/effect/tree/7ff5048db51daba7c31ee90d5e3d17861a9e6b50/packages),
plus the official language-service, tsgo, ESLint, and VS Code tools and related
maintenance utilities. The public monorepo manifests use version `4.0.2` at this
snapshot. Independently released developer tools have their own version numbers.
This inventory does not claim to cover every third-party community package.

Compared their documented capabilities, package metadata, and relevant source
with this repo's current code and tooling:

- A directly published `index.mjs` configuration and `index.d.ts` declaration,
  with no build step.
- Vitest 5.0.2, TypeScript 6.0.3, ESLint 10.10.0, and Prettier 3.9.9.
- Node-based smoke tests that pack, extract, install, and execute consumers.
- Existing formatting fixtures, consumer-local plugin assertions, public-type
  checks, Publint, and Are the Types Wrong.
- Exact dependency pins, npm, `min-release-age=7`, and `ignore-scripts=true`.

The verdicts below are judgments about this repository. The selected packages
have been integrated and verified; unselected packages have not been installed.
Compatibility statements based on metadata are labeled as such. Formatter fixture languages do not establish a need for framework or
alternative-runtime integrations.

## Public v4 packages: core, platforms, testing, and telemetry

| Package                        | Verdict              | Reason for this repo                                                                                                           |
| ------------------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `effect`                       | Adopt in development | Typed failures, scopes, layers, interruption, and asynchronous resource handling fit the smoke harness.                        |
| `@effect/platform-node-shared` | Adopt in development | Supplies the Node filesystem, path, and child-process implementations the harness needs.                                       |
| `@effect/vitest`               | Adopt in development | Supplies scoped tests, shared layers, and cancellation integration with the existing runner.                                   |
| `@effect/platform-node`        | Defer                | The shared adapter already covers this harness. The full adapter adds services and dependencies without a current requirement. |
| `@effect/platform-browser`     | Skip                 | The harness executes Node processes; there is no browser application.                                                          |
| `@effect/platform-bun`         | Skip                 | There is no Bun harness or supported Bun validation job.                                                                       |
| `@effect/platform-deno`        | Skip                 | There is no Deno harness or supported Deno validation job.                                                                     |
| `@effect/opentelemetry`        | Skip                 | No telemetry exporter or tracing backend is required. Phase-specific command diagnostics address the current problem.          |

The selected `@effect/vitest@4.0.0` tarball declares an Effect `^4.0.0` peer and
Vitest `>=5.0.0 <6.0.0`, matching the current runner. Source inspection confirms
its cancellation bridge interrupts the Effect and waits for finalizers after a
test abort. This is a reason to use the integration rather than maintain that
lifecycle in a custom bridge.
[Source](https://github.com/Effect-TS/effect/blob/main/packages/vitest/src/internal/internal.ts)

Real subprocess tests require live services: use `it.live` for standalone
regressions and `layer(..., { excludeTestServices: true })` for the shared suite.
The default `it.effect` helper supplies a test clock and console; those defaults
are unsuitable for real npm/process deadlines without additional clock handling.
[Helper API](https://github.com/Effect-TS/effect/blob/main/packages/vitest/src/index.ts)

Registry inspection of `4.0.0` shows the shared adapter depends on `ws` and
`@types/ws`. The full Node adapter additionally depends on Undici and declares a
Redis peer. The shared adapter is sufficient, but it still has transitive costs.
[Shared metadata](https://github.com/Effect-TS/effect/blob/main/packages/platform/node-shared/package.json),
[full Node metadata](https://github.com/Effect-TS/effect/blob/main/packages/platform/node/package.json)

## Public v4 packages: documentation and generation

| Package                     | Verdict              | Reason for this repo                                                                                                                                                                       |
| --------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@effect/doctest`           | Optional future work | Can execute marked TypeScript examples in Markdown, MDX, or JSDoc. Useful if README examples need their own coverage; existing packed-consumer tests already verify runtime use and types. |
| `@effect/docgen`            | Skip                 | A generated API documentation site is unnecessary for the current small configuration export and handwritten README.                                                                       |
| `@effect/openapi-generator` | Skip                 | The repo has no OpenAPI specification or generated API client.                                                                                                                             |

Doctest uses isolated Vitest modules and requires Vitest 5 with Vite
`>=8.1.5 <9.0.0`. Adopting it would require marked examples and explicit source
collection, so it is a separate documentation-testing change.
[Doctest documentation](https://github.com/Effect-TS/effect/blob/main/packages/tools/doctest/README.md)

Docgen and OpenAPI generation have distinct documentation/code-generation
purposes; they do not improve subprocess ownership or the package contract.
[Docgen documentation](https://github.com/Effect-TS/effect/blob/main/packages/tools/docgen/README.md),
[OpenAPI generator documentation](https://github.com/Effect-TS/effect/blob/main/packages/tools/openapi-generator/README.md)

## Public v4 packages: UI bindings

All three are unnecessary for this repo. Framework files in formatting fixtures
are test inputs; the package does not render an application or manage UI state.

| Package              | Verdict | Integration |
| -------------------- | ------- | ----------- |
| `@effect/atom-react` | Skip    | React       |
| `@effect/atom-solid` | Skip    | SolidJS     |
| `@effect/atom-vue`   | Skip    | Vue         |

## Public v4 packages: AI providers

All six are unnecessary for this repo. Packing, formatting, installation, and
consumer assertions are deterministic checks with no model-provider requirement.

| Package                    | Verdict | Provider               |
| -------------------------- | ------- | ---------------------- |
| `@effect/ai-anthropic`     | Skip    | Anthropic              |
| `@effect/ai-cloudflare`    | Skip    | Cloudflare             |
| `@effect/ai-openai`        | Skip    | OpenAI                 |
| `@effect/ai-openai-compat` | Skip    | OpenAI-compatible APIs |
| `@effect/ai-openrouter`    | Skip    | OpenRouter             |
| `@effect/ai-typesafe`      | Skip    | TypeSafe               |

## Public v4 packages: SQL adapters

All 12 are unnecessary for this repo. It has no database-backed behavior or
persistence requirement for the harness.

| Package                           | Verdict | Database/runtime                  |
| --------------------------------- | ------- | --------------------------------- |
| `@effect/sql-clickhouse`          | Skip    | ClickHouse                        |
| `@effect/sql-d1`                  | Skip    | Cloudflare D1                     |
| `@effect/sql-libsql`              | Skip    | libSQL                            |
| `@effect/sql-mssql`               | Skip    | Microsoft SQL Server              |
| `@effect/sql-mysql2`              | Skip    | MySQL                             |
| `@effect/sql-pg`                  | Skip    | PostgreSQL                        |
| `@effect/sql-pglite`              | Skip    | PGlite                            |
| `@effect/sql-sqlite-bun`          | Skip    | SQLite through Bun                |
| `@effect/sql-sqlite-do`           | Skip    | Cloudflare Durable Objects SQLite |
| `@effect/sql-sqlite-node`         | Skip    | SQLite through Node               |
| `@effect/sql-sqlite-react-native` | Skip    | React Native SQLite               |
| `@effect/sql-sqlite-wasm`         | Skip    | WebAssembly SQLite                |

UI, provider, and database descriptions follow the
[official package catalog](https://github.com/Effect-TS/effect#packages).

## Developer plugins and tools

| Tool                              | Verdict                | Benefit and tradeoff                                                                                                                                                                                 |
| --------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@effect/language-service`        | Include in development | Add editor diagnostics and the standalone diagnostic CLI to the implementation.                                                                                                                      |
| `@effect/tsgo`                    | Defer                  | The native TypeScript tool targets TypeScript 7; this repo uses TypeScript 6.0.3. Revisit during a separately justified compiler upgrade.                                                            |
| `@effect/eslint-plugin`           | Skip                   | Its current exported rules are `dprint` and `no-import-from-barrel-package`. It does not provide the Effect correctness diagnostics needed here, and adds formatter dependencies to a Prettier repo. |
| Effect VS Code DevTools extension | Skip for Zed           | Its dedicated UI targets VS Code. Use Effect logging and Zed's Node/Vitest debugger for the initial harness.                                                                                         |

### Language service

The language-service documentation identifies v4-supported diagnostics including
floating Effects, duplicate packages, and unsafe error/requirement channels.
It is independently versioned; registry `latest` was `0.87.4` during this review.
The seven-day release-age policy currently permits `0.87.3`, published September
28; `0.87.4` was published October 6 and is too recent. Recheck the selected
release's compiler and v4 support when implementing.

Adding a `tsconfig.json` plugin enables editor behavior, not diagnostics in plain
`tsc`. The standalone `effect-language-service diagnostics` command works without
patching TypeScript. The CLI is included in full validation. The selected release was checked
against this repo's compiler and harness.
[Language-service documentation](https://github.com/Effect-TS/language-service)

Zed's default `vtsls` server supports locally installed TypeScript plugins.
Register the plugin in `compilerOptions.plugins` and enable the workspace
TypeScript SDK. The project includes these settings in `.zed/settings.json`;
no VS Code editor configuration is required.
[Zed TypeScript support](https://zed.dev/docs/languages/typescript),
[vtsls plugin setup](https://github.com/yioneko/vtsls#typescript-plugin-not-activated)

### Native compiler integration

The tsgo project targets the native TypeScript compiler and supports Effect v3
and v4. Its documented TypeScript 7 requirement makes it a future compiler
decision, rather than a prerequisite for using Effect with TypeScript 6.
[tsgo documentation](https://github.com/Effect-TS/tsgo)

### ESLint plugin

Registry `latest` was `0.3.2`. Inspection found dprint formatter dependencies and
the two rules listed above. This assessment does not assert an ESLint 10
incompatibility; the plugin's available rules simply do not justify adding it
for this migration.
[Rule exports](https://github.com/Effect-TS/eslint-plugin/blob/main/src/plugin.ts),
[package metadata](https://github.com/Effect-TS/eslint-plugin/blob/main/package.json)

### DevTools

The extension's dedicated UI targets VS Code and is not part of the recommended
Zed setup. Zed supports ordinary Node/Vitest debugging, and Effect's logging can
provide harness diagnostics without that extension.
[Zed debugging support](https://zed.dev/docs/languages/typescript#debugging)

The extension README still includes v3 `@effect/experimental` setup examples. For v4,
check the `effect/devtools` exports and the chosen release's adapter APIs before
configuring a connection.
[Extension documentation](https://github.com/Effect-TS/vscode-extension),
[v4 core exports](https://github.com/Effect-TS/effect/blob/main/packages/effect/package.json)

## Capabilities already included in v4

The migration guide consolidates many former packages into `effect`. Separate
v3 dependencies such as `@effect/platform`, `@effect/cli`, `@effect/rpc`,
`@effect/cluster`, `@effect/workflow`, `@effect/ai`, `@effect/sql`, and
`@effect/experimental` should not be added to this v4 plan.
[Migration guide](https://github.com/Effect-TS/effect/blob/main/MIGRATION.md)

| Capability                                                         | Decision for this repo                                                                                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Effect, Scope, Layer, Context, Cause, and tagged errors            | Use the minimum set needed for resource ownership and failure context.                                                                     |
| Process services and streaming                                     | Use for asynchronous commands and concurrent bounded stdout/stderr collection; Node implementations come from the selected shared adapter. |
| TestClock                                                          | Use only if isolated logic needs deterministic time; actual subprocess tests use live services.                                            |
| Arbitrary/property testing                                         | Available through the testing integration; defer until a concrete generated-input invariant warrants it.                                   |
| Schema                                                             | Defer additional decoding machinery unless command output or configuration develops a meaningful validation requirement.                   |
| Schedule/retries                                                   | Defer. Retrying package failures would change the existing test contract and can obscure deterministic problems.                           |
| CLI                                                                | Defer until there is a real command-line interface to design; current npm scripts do not need a new CLI framework.                         |
| HTTP, RPC, cluster, workflow, SQL, AI, persistence, and reactivity | Skip for the current package and harness.                                                                                                  |
| DevTools and built-in logging/spans                                | Optional debugging aids; external telemetry is not necessary for useful command errors.                                                    |

Core subpaths are documented in the
[v4 API catalog](https://effect.website/docs/v4/api) and
[package export map](https://github.com/Effect-TS/effect/blob/main/packages/effect/package.json).

## Private and auxiliary tooling

The v4 monorepo marks `@effect/ai-codegen`, `@effect/ai-docgen`,
`@effect/api-diff`, `@effect/bundle`, `@effect/jsdocs`, `@effect/oxc`, and
`@effect/utils` as private internal tools. They are not consumer packages to add
to this repo. In particular, the internal `@effect/oxc` tool is unrelated to this
package's existing `@prettier/plugin-oxc` parser integration.
[Tooling manifests](https://github.com/Effect-TS/effect/tree/7ff5048db51daba7c31ee90d5e3d17861a9e6b50/packages/tools)

Related official maintenance utilities also lack a current requirement:

| Utility                    | Verdict and reason                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------- |
| Effect codemod             | Skip: no existing Effect v3 code needs migration.                                     |
| Effect build-utils         | Skip: this package publishes its JavaScript directly without a build pipeline.        |
| Effect dtslint fork        | Skip: the repo already has consumer compilation and ATTW; the fork is archived.       |
| `@effect/markdown-toc`     | Defer: automated README navigation is a separate documentation need.                  |
| Effect next-release action | Skip: the existing Release Please workflow already owns release automation.           |
| Legacy `@effect-ts/figlet` | Skip: a terminal banner has no harness requirement and belongs to an older ecosystem. |

Reviewed their official repositories:
[codemod](https://github.com/Effect-TS/codemod),
[build-utils](https://github.com/Effect-TS/build-utils),
[dtslint](https://github.com/Effect-TS/dtslint),
[markdown-toc](https://github.com/Effect-TS/markdown-toc),
[next-release-action](https://github.com/Effect-TS/next-release-action), and
[figlet](https://github.com/Effect-TS/figlet).
Examples, websites, and standalone applications in the organization are not
additional harness plugins.

## Version and implementation constraints

On the review date, the three synchronized v4 packages have stable `4.0.2` releases.
Their `4.0.0` releases were published on October 1 and are the initial candidates
allowed by the repo's seven-day release-age policy; `4.0.1` and `4.0.2` are too
recent. Implementation rechecked registry metadata and selected matching exact
`4.0.0` pins plus `@effect/language-service@0.87.3`, preserving the seven-day
policy. Developer tools do not share the core packages' version.

Some platform and testing APIs are marked unstable despite the stable v4 package
release. Verify installed-version exports and cleanup behavior, then run the
implementation plan's failure, interruption, package, and minimum-runtime checks.
The [implementation record](./IMPLEMENTATION_PLAN.md) documents the completed
integration and validation.
