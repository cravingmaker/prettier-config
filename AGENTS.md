# Agent guidance

## Effect source reference

Following [Effect's source-reference approach](https://effect.website/blog/the-one-weird-git-trick-that-makes-coding-agents-more-effect-ive/),
the local checkout at `repos/effect` gives coding agents implementations,
tests, and examples for writing version-correct Effect code. Keep it pinned to
the installed Effect release using the pin in `scripts/effect-reference.json`.

Before writing Effect code, run `npm run setup:effect-reference` to acquire or
verify the checkout, then read `repos/effect/LLMS.md` and relevant source and
tests. For this harness, start with Scope/Layer in `packages/effect/src/`,
the spawner in `packages/platform/node-shared/src/NodeChildProcessSpawner.ts`,
and `packages/vitest/src/internal/internal.ts` plus their tests.

Treat `repos/` as read-only reference material: import from installed npm
packages and edit reference sources only when explicitly requested. See the
[development guide](./README.md#development) for setup and version updates.
