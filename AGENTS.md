# Agent guidance

Read [CONTRIBUTING.md](CONTRIBUTING.md) before making changes.

## Repository map and contracts

- `index.mjs` is the directly published ESM runtime; `index.d.ts` is its public contract. Keep required properties, absolute plugin resolution, Tailwind-last ordering, separate Oxc parsers, and existing formatter output.
- `prettier.config.mjs` uses the published runtime for this repository. There is no build step. Preserve the five-file tarball and keep tools in devDependencies.
- `tests/consumers/` contains checked executable npm-consumer programs; `tests/fixtures/` contains raw inputs and the intentional installed-type fixture.
- `tests/helpers/package-smoke.ts` owns shared Effect-scoped installations; `tests/helpers/node-command.ts` owns native process events and buffers. Preserve cleanup on failure, deadlines, and interruption; process tests use live clocks.
- `scripts/` contains checked development tools and local ESLint rules. `.github/workflows/` owns CI and publishing checks.
- Consumers support Node 22.12.0; development tools require Node >=24.15.0. Run type tools on the development runtime and select consumer Node separately.

Markdown keeps each paragraph and list item on one line, as `proseWrap: "never"` formats it. Write pull request bodies and release notes the same way, because GitHub renders their line breaks.

Add meaningful regressions before behavior changes. Review intentional snapshot changes; never update snapshots merely to obtain passing checks. Preserve unrelated work and keep pull requests focused.

Use the targeted [change recipes](docs/architecture.md#change-recipes), then run `npm run validate` and `git diff --check` before a PR. Verify remote checks separately; required CI contexts and publishing validation must remain effective.

## Effect

Use public, stable APIs only. Check the module and symbol documentation for `@stability unstable` or experimental annotations; an ordinary import path does not establish stability. Upstream examples may use APIs outside this rule.

See [Effect tooling](CONTRIBUTING.md#effect-tooling) and the [architecture guide](docs/architecture.md) for ownership and checks.
