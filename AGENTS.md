# Agent guidance

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

See the [development guide](./README.md#development) for setup and pin updates.
