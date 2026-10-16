import { describe, expect, it, vi } from "vitest";

import { syncEffectReference } from "../scripts/dependabot-effect-reference.mjs";

const repository = "cravingmaker/prettier-config";
const branch = "dependabot/npm_and_yarn/effect-reference-48d229795c";
const head = "a".repeat(40);
const commit = "b".repeat(40);
const version = "4.0.2";
const referencePath = "scripts/effect-reference.json";
const names = ["effect", "@effect/platform-node-shared", "@effect/vitest"] as const;
const dependencies = Object.fromEntries<string>(names.map((name) => [name, version]));
const reference = {
  commit: "c".repeat(40),
  repository: "https://github.com/Effect-TS/effect.git",
  tag: "effect@4.0.0",
  version: "4.0.0",
};
const expected = { ...reference, commit, tag: `effect@${version}`, version };
const repositoryData = (fullName: string) => Object.fromEntries([["full_name", fullName]]);
const pull = {
  base: { ref: "main", repo: repositoryData(repository) },
  head: { ref: branch, repo: repositoryData(repository), sha: head },
  number: 142,
  state: "open",
  user: { login: "dependabot[bot]" },
};
const pullEndpoint = `/repos/${repository}/pulls?state=open&head=${encodeURIComponent(`cravingmaker:${branch}`)}&per_page=100`;
const filesEndpoint = `/repos/${repository}/pulls/142/files?per_page=100`;
const contentEndpoint = (filename: string) => `/repos/${repository}/contents/${filename}?ref=${head}`;
const upstreamEndpoint = (filename: string) => `/repos/Effect-TS/effect/contents/${filename}?ref=${commit}`;
const tagEndpoint = `/repos/Effect-TS/effect/git/ref/tags/effect%404.0.2`;
const content = (value: unknown) => ({
  content: btoa(JSON.stringify(value)),
  encoding: "base64",
  type: "file",
});
const lock = {
  lockfileVersion: 3,
  packages: Object.fromEntries<unknown>([
    ["", { devDependencies: dependencies }],
    ...names.map((name) => [`node_modules/${name}`, { version }] as const),
  ]),
};
const fixture = (overrides: Readonly<Record<string, unknown>> = {}) => {
  const responses = new Map<string, unknown>([
    [contentEndpoint("package-lock.json"), content(lock)],
    [
      contentEndpoint("package.json"),
      content({
        devDependencies: dependencies,
      }),
    ],
    [contentEndpoint(referencePath), content(reference)],
    [
      filesEndpoint,
      ["package.json", "package-lock.json"].map((filename) => ({
        filename,
        status: "modified",
      })),
    ],
    [
      "/graphql",
      {
        data: { createCommitOnBranch: { commit: { oid: "d".repeat(40) } } },
      },
    ],
    [pullEndpoint, [pull]],
    [tagEndpoint, { object: { sha: commit, type: "commit" } }],
    [
      upstreamEndpoint("packages/effect/package.json"),
      content({
        name: "effect",
        version,
      }),
    ],
    [
      upstreamEndpoint("packages/platform/node-shared/package.json"),
      content({ name: "@effect/platform-node-shared", version }),
    ],
    [
      upstreamEndpoint("packages/vitest/package.json"),
      content({
        name: "@effect/vitest",
        version,
      }),
    ],
    ...Object.entries(overrides),
  ]);
  const request = vi.fn(async (endpoint: string, _body?: Readonly<Record<string, unknown>>): Promise<unknown> => {
    const response = await Promise.resolve(responses.get(endpoint));
    // eslint-disable-next-line functional/no-promise-reject -- Reproduce a GitHub API failure.
    if (response instanceof Error) throw response;
    if (response === undefined)
      // eslint-disable-next-line functional/no-promise-reject -- Unexpected requests must fail the test.
      throw new Error(`Unexpected request: ${endpoint}`);
    return response;
  });
  return {
    request,
    run: async () => await syncEffectReference({ branch, head, repository, request }),
    writes: () => request.mock.calls.filter(([, body]) => body !== undefined),
  };
};

describe("Dependabot Effect reference synchronization", () => {
  it("repairs a grouped update in one commit tied to the inspected PR head", async () => {
    const test = fixture();
    await expect(test.run()).resolves.toContain("Updated #142");
    const writes = test.writes();
    expect(writes).toHaveLength(1);
    expect(writes[0]?.[0]).toBe("/graphql");
    expect(writes[0]?.[1]?.query).toContain("createCommitOnBranch");
    expect(writes[0]?.[1]?.variables).toEqual({
      input: {
        branch: { branchName: branch, repositoryNameWithOwner: repository },
        expectedHeadOid: head,
        fileChanges: {
          additions: [
            {
              contents: btoa(`${JSON.stringify(expected, undefined, 2)}\n`),
              path: referencePath,
            },
          ],
        },
        message: {
          headline: `chore(deps-dev): sync Effect ${version} source reference`,
        },
      },
    });
  });

  it("does not create another commit when the reference is already synchronized", async () => {
    const test = fixture({
      [contentEndpoint(referencePath)]: content(expected),
      [filesEndpoint]: ["package.json", "package-lock.json", referencePath].map((filename) => ({
        filename,
        status: "modified",
      })),
    });
    await expect(test.run()).resolves.toContain("already synchronized");
    expect(test.writes()).toEqual([]);
  });

  it("repairs a stale commit even when the reference version matches", async () => {
    const test = fixture({
      [contentEndpoint(referencePath)]: content({
        ...expected,
        commit: reference.commit,
      }),
    });
    await expect(test.run()).resolves.toContain("Updated #142");
    expect(test.writes()).toHaveLength(1);
  });

  it.each([
    { user: { login: "contributor" } },
    { head: { ...pull.head, repo: repositoryData("fork/prettier-config") } },
    { base: { ...pull.base, ref: "feature" } },
    { state: "closed" },
    { head: { ...pull.head, sha: "e".repeat(40) } },
  ])("does not write for ineligible or stale pull requests: %j", async (change) => {
    const test = fixture({ [pullEndpoint]: [{ ...pull, ...change }] });
    await expect(test.run()).resolves.toContain("Skipped");
    expect(test.writes()).toEqual([]);
    expect(test.request).toHaveBeenCalledTimes(1);
  });

  it.each([
    { filename: "index.mjs", status: "modified" },
    { filename: "package.json", status: "renamed" },
  ])("rejects unexpected changed files: %j", async (file) => {
    const test = fixture({ [filesEndpoint]: [file] });
    await expect(test.run()).rejects.toThrow("changed files");
    expect(test.writes()).toEqual([]);
  });

  it("rejects mixed package versions before resolving upstream", async () => {
    const test = fixture({
      [contentEndpoint("package.json")]: content({
        devDependencies: { ...dependencies, [names[2]]: "4.0.1" },
      }),
    });
    await expect(test.run()).rejects.toThrow("@effect/vitest");
    expect(test.writes()).toEqual([]);
    expect(test.request.mock.calls.some(([endpoint]) => endpoint === tagEndpoint)).toBe(false);
  });

  it.each([
    {
      packages: {
        ...lock.packages,
        ...Object.fromEntries([["", { devDependencies: { ...dependencies, effect: "4.0.1" } }]]),
      },
    },
    {
      packages: {
        ...lock.packages,
        ...Object.fromEntries([["node_modules/effect", { version: "4.0.1" }]]),
      },
    },
    { lockfileVersion: 2 },
  ])("rejects inconsistent lockfiles: %j", async (change) => {
    const test = fixture({
      [contentEndpoint("package-lock.json")]: content({ ...lock, ...change }),
    });
    await expect(test.run()).rejects.toThrow("package-lock.json");
    expect(test.writes()).toEqual([]);
  });

  it("dereferences an annotated upstream tag before pinning its commit", async () => {
    const tag = "f".repeat(40);
    const test = fixture({
      [`/repos/Effect-TS/effect/git/tags/${tag}`]: {
        object: { sha: commit, type: "commit" },
      },
      [tagEndpoint]: { object: { sha: tag, type: "tag" } },
    });
    await expect(test.run()).resolves.toContain("Updated #142");
    expect(test.writes()).toHaveLength(1);
  });

  it.each([
    { [tagEndpoint]: new Error("tag not found") },
    {
      [upstreamEndpoint("packages/vitest/package.json")]: content({
        name: "@effect/vitest",
        version: "4.0.1",
      }),
    },
    {
      [contentEndpoint(referencePath)]: content({
        ...reference,
        repository: "https://example.invalid/effect.git",
      }),
    },
  ])("does not commit an unverified upstream reference: %j", async (overrides) => {
    const test = fixture(overrides);
    await expect(test.run()).rejects.toThrow();
    expect(test.writes()).toEqual([]);
  });

  it("surfaces a concurrent head change without retrying the write", async () => {
    const test = fixture({
      ...Object.fromEntries([["/graphql", new Error("expectedHeadOid no longer matches")]]),
    });
    await expect(test.run()).rejects.toThrow("expectedHeadOid");
    expect(test.writes()).toHaveLength(1);
  });
});
