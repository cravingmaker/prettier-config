# Agent guidance

Read [CONTRIBUTING.md](CONTRIBUTING.md) before making changes.

## Repository map and contracts

- `index.mjs` is the directly published ESM runtime; `index.d.ts` is its public
  contract. Keep required properties, absolute plugin resolution, Tailwind-last
  ordering, separate Oxc parsers, and existing formatter output.
- `prettier.config.mjs` uses the published runtime for this repository. There is
  no build step. Preserve the five-file tarball and keep tools in devDependencies.
- `tests/consumers/` contains checked executable npm-consumer programs;
  `tests/fixtures/` contains raw inputs and the intentional installed-type fixture.
- `tests/helpers/package-smoke.ts` owns shared Effect-scoped installations;
  `tests/helpers/node-command.ts` owns native process events and buffers. Preserve
  cleanup on failure, deadlines, and interruption; process tests use live clocks.
- `scripts/` contains checked development tools, local ESLint rules, and source
  metadata. `.github/workflows/` owns CI and publishing checks.
- Consumers support Node 22.12.0; development tools require Node >=22.22.1.
  Run type tools on the development runtime and select consumer Node separately.

Add meaningful regressions before behavior changes. Review intentional snapshot
changes; never update snapshots merely to obtain passing checks. Preserve unrelated
work and keep pull requests focused.

Use the targeted [change recipes](docs/architecture.md#change-recipes), then run
`npm run validate` and `git diff --check` before a PR. Verify remote checks separately;
required CI contexts and publishing validation must remain effective.

## Dependency source references

External library checkouts belong under `repos/`, following
[Effect's source-reference approach](https://effect.website/blog/the-one-weird-git-trick-that-makes-coding-agents-more-effect-ive/).

- Consult the relevant source, examples, and tests instead of guessing library behavior.
- Keep these checkouts untouched unless the task explicitly requests changes to them.
- Resolve imports through installed packages; never use `repos/` as an application dependency.

## Effect

Before writing Effect code, run `npm run setup:effect-reference` and read
`repos/effect/LLMS.md`. Use this pinned checkout to verify APIs and idioms.

Use public, stable APIs only. Check the module and symbol documentation for
`@stability unstable` or experimental annotations; an ordinary import path
does not establish stability. Upstream examples may use APIs outside this rule.

See [Effect reference setup](CONTRIBUTING.md#effect-reference) and the
[architecture guide](docs/architecture.md) for ownership, pin updates, and checks.
