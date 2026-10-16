import { Schema } from "effect";

import { effectPackages, referenceSchema } from "./effect-reference-metadata.mjs";
import { decodeJson, decodeValue, packageManifestSchema } from "./manifest.mjs";

/** @typedef {(endpoint: string, body?: Readonly<Record<string, unknown>>) => Promise<unknown>} GitHubRequest */

const upstream = "Effect-TS/effect";
const referencePath = "scripts/effect-reference.json";
const shaSchema = Schema.String.check(Schema.isPattern(/^[\da-f]{40}$/));
const versionSchema = Schema.String.check(Schema.isPattern(/^\d+\.\d+\.\d+$/));
// eslint-disable-next-line camelcase -- GitHub's JSON field name is part of the external API contract.
const repositorySchema = Schema.Struct({ full_name: Schema.String });
const pullSchema = Schema.Struct({
  base: Schema.Struct({ ref: Schema.String, repo: repositorySchema }),
  head: Schema.Struct({
    ref: Schema.String,
    repo: repositorySchema,
    sha: shaSchema,
  }),
  number: Schema.Number,
  state: Schema.String,
  user: Schema.Struct({ login: Schema.String }),
});
const filesSchema = Schema.Array(Schema.Struct({ filename: Schema.String, status: Schema.String }));
const fileSchema = Schema.Struct({
  content: Schema.String,
  encoding: Schema.Literal("base64"),
  type: Schema.Literal("file"),
});
const dependenciesSchema = Schema.Struct({
  devDependencies: Schema.Record(Schema.String, Schema.String),
});
const lockSchema = Schema.Struct({
  lockfileVersion: Schema.Literal(3),
  packages: Schema.Record(Schema.String, Schema.Unknown),
});
const packageManifestVersionSchema = Schema.Struct({ version: Schema.String });
const objectSchema = Schema.Struct({
  sha: shaSchema,
  type: Schema.Literals(["commit", "tag"]),
});
const tagSchema = Schema.Struct({ object: objectSchema });
const commitOidSchema = Schema.Struct({ oid: shaSchema });
const commitSchema = Schema.Struct({
  data: Schema.Struct({
    createCommitOnBranch: Schema.Struct({
      commit: commitOidSchema,
    }),
  }),
});

/**
 * @template {import('effect/Schema').Constraint & { readonly DecodingServices: never }} S
 * @param {GitHubRequest} request
 * @param {Readonly<{ repository: string; filename: string; commit: string }>} file
 * @param {S} schema
 */
const readJson = async (request, { commit, filename, repository }, schema) => {
  const endpoint = `/repos/${repository}/contents/${filename}?ref=${commit}`;
  const file = decodeValue(fileSchema, await request(endpoint), endpoint, "read GitHub file");
  const contents = decodeValue(
    Schema.StringFromBase64,
    file.content.replaceAll("\n", ""),
    filename,
    "decode GitHub contents",
  );
  return decodeJson(schema, contents, filename, "verify Effect update");
};

/** @param {GitHubRequest} request @param {typeof objectSchema.Type} object @param {number} [depth] @returns {Promise<string>} */
const resolveCommit = async (request, object, depth = 0) => {
  if (object.type === "commit") return object.sha;
  if (depth >= 5) throw new Error("Effect tag contains too many nested annotated tags");
  const endpoint = `/repos/${upstream}/git/tags/${object.sha}`;
  const tag = decodeValue(tagSchema, await request(endpoint), endpoint, "resolve Effect tag");
  return resolveCommit(request, tag.object, depth + 1);
};

/** @param {Readonly<{ request: GitHubRequest; repository: string; branch: string; head: string }>} options */
const syncEffectReference = async ({ branch, head, repository, request }) => {
  if (!/^[\w\-.]+\/[\w\-.]+$/.test(repository) || !branch.startsWith("dependabot/npm_and_yarn/effect-reference-"))
    throw new Error("Expected a repository and grouped Dependabot Effect branch");
  decodeValue(shaSchema, head, "workflow_run.head_sha", "verify triggering commit");
  const owner = repository.slice(0, repository.indexOf("/"));
  const pullsEndpoint = `/repos/${repository}/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}&per_page=100`;
  const pulls = decodeValue(
    Schema.Array(pullSchema),
    await request(pullsEndpoint),
    pullsEndpoint,
    "find Dependabot pull request",
  );
  const pull = pulls.find(
    (candidate) =>
      candidate.state === "open" &&
      candidate.user.login === "dependabot[bot]" &&
      candidate.base.ref === "main" &&
      candidate.base.repo.full_name === repository &&
      candidate.head.repo.full_name === repository &&
      candidate.head.ref === branch &&
      candidate.head.sha === head,
  );
  if (!pull) return "Skipped: no current, same-repository Dependabot Effect PR for this CI commit";

  const filesEndpoint = `/repos/${repository}/pulls/${String(pull.number)}/files?per_page=100`;
  const files = decodeValue(filesSchema, await request(filesEndpoint), filesEndpoint, "verify changed files");
  const allowed = new Set(["package-lock.json", "package.json", referencePath]);
  if (
    files.some((file) => file.status !== "modified" || !allowed.has(file.filename)) ||
    ["package.json", "package-lock.json"].some((filename) => files.every((file) => file.filename !== filename))
  )
    throw new Error("Unexpected changed files in the Dependabot Effect PR");

  const [manifest, lock, reference] = await Promise.all([
    readJson(request, { commit: head, filename: "package.json", repository }, dependenciesSchema),
    readJson(request, { commit: head, filename: "package-lock.json", repository }, lockSchema),
    readJson(request, { commit: head, filename: referencePath, repository }, referenceSchema),
  ]);
  if (reference.repository !== `https://github.com/${upstream}.git`)
    throw new Error("Effect source repository differs from the trusted upstream");
  const version = decodeValue(
    versionSchema,
    manifest.devDependencies.effect,
    "package.json",
    "verify exact Effect version",
  );
  const root = decodeValue(dependenciesSchema, lock.packages[""], "package-lock.json", "verify root dependency pins");
  const declared = new Map(Object.entries(manifest.devDependencies));
  const locked = new Map(Object.entries(root.devDependencies));
  // eslint-disable-next-line functional/no-loop-statements -- Every coordinated package must match before any write.
  for (const { name } of effectPackages) {
    if (declared.get(name) !== version) throw new Error(`package.json: ${name} must match Effect ${version}`);
    const installed = decodeValue(
      packageManifestVersionSchema,
      lock.packages[`node_modules/${name}`],
      "package-lock.json",
      `verify ${name}`,
    );
    if (locked.get(name) !== version || installed.version !== version)
      throw new Error(`package-lock.json: ${name} must match Effect ${version}`);
  }

  const tag = `effect@${version}`;
  const tagEndpoint = `/repos/${upstream}/git/ref/tags/${encodeURIComponent(tag)}`;
  const resolved = decodeValue(tagSchema, await request(tagEndpoint), tagEndpoint, "resolve Effect release");
  const commit = await resolveCommit(request, resolved.object);
  await Promise.all(
    effectPackages.map(async ({ manifest: filename, name }) => {
      const source = await readJson(request, { commit, filename, repository: upstream }, packageManifestSchema);
      if (source.name !== name || source.version !== version)
        throw new Error(`Upstream ${name} does not match Effect ${version}`);
    }),
  );
  if (reference.version === version && reference.tag === tag && reference.commit === commit)
    return `Effect ${version} source reference already synchronized`;

  // eslint-disable-next-line n/no-sync -- Base64 encoding is pure and performs no synchronous I/O.
  const contents = Schema.encodeSync(Schema.StringFromBase64)(
    `${JSON.stringify({ commit, repository: reference.repository, tag, version }, undefined, 2)}\n`,
  );
  const result = await request("/graphql", {
    query: `mutation SyncEffectReference($input: CreateCommitOnBranchInput!) {
      createCommitOnBranch(input: $input) { commit { oid } }
    }`,
    variables: {
      input: {
        branch: { branchName: branch, repositoryNameWithOwner: repository },
        expectedHeadOid: head,
        fileChanges: { additions: [{ contents, path: referencePath }] },
        message: {
          headline: `chore(deps-dev): sync Effect ${version} source reference`,
        },
      },
    },
  });
  const created = decodeValue(commitSchema, result, "createCommitOnBranch", "commit Effect reference");
  return `Updated #${String(pull.number)} to Effect ${version} at ${created.data.createCommitOnBranch.commit.oid}`;
};

export { syncEffectReference };
