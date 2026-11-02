# Agent guidance

Read [CONTRIBUTING.md](CONTRIBUTING.md) before making changes.

## Repository map and contracts

- `index.mjs` is the directly published ESM runtime; `index.d.ts` is its public contract. Keep required properties, absolute plugin resolution, Tailwind-last ordering, separate Oxc parsers, and existing formatter output.
- `prettier.config.mjs` uses the published runtime for this repository. There is no build step. Preserve the five-file tarball and keep tools in devDependencies.
- `tests/consumers/` contains checked executable npm-consumer programs; `tests/fixtures/` contains raw inputs and the intentional installed-type fixture.
- `tests/package.test.ts` packs the package and installs it into temporary consumer projects; `tests/helpers/command.ts` runs their commands. Keep the workspace removed after a failed setup, a deadline on every command, and the test's abort signal on every command that a test runs.
- `scripts/` contains checked development tools. `.github/workflows/` owns CI and publishing checks.
- Consumers support Node 22.12.0; development tools require Node >=24.15.0. Run type tools on the development runtime and select consumer Node separately.

Markdown keeps each paragraph and list item on one line, as `proseWrap: "never"` formats it. Write pull request bodies and release notes the same way, because GitHub renders their line breaks.

Add meaningful regressions before behavior changes. Test this package's configuration and contracts, not the behavior of Prettier, its plugins, or the repository's tools. Review intentional snapshot changes; never update snapshots merely to obtain passing checks. Preserve unrelated work and keep pull requests focused.

Use the targeted [change recipes](docs/architecture.md#change-recipes), then run `npm run validate` and `git diff --check` before a PR. Verify remote checks separately; required CI contexts and publishing validation must remain effective.
