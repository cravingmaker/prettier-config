import process from "node:process";

import { Schema } from "effect";

import { syncEffectReference } from "./dependabot-effect-reference.mjs";
import { decodeJson, decodeValue } from "./manifest.mjs";

const environmentSchema = Schema.Struct({
  EFFECT_PR_BRANCH: Schema.String,
  EFFECT_PR_HEAD: Schema.String,
  GITHUB_REPOSITORY: Schema.String,
});
const errorSchema = Schema.Struct({ message: Schema.String });
const errorsSchema = Schema.Struct({
  errors: Schema.optional(Schema.Array(errorSchema)),
});

try {
  // eslint-disable-next-line n/no-process-env -- Read the token separately so schema diagnostics cannot include credentials.
  const token = process.env.GH_TOKEN;
  if (!token?.trim()) throw new Error("GH_TOKEN must be set");
  const environment = decodeValue(
    environmentSchema,
    Object.fromEntries(
      // eslint-disable-next-line n/no-process-env -- Filter credentials out before decoding workflow metadata.
      Object.entries(process.env).filter(([name]) =>
        ["EFFECT_PR_BRANCH", "EFFECT_PR_HEAD", "GITHUB_REPOSITORY"].includes(
          name,
        ),
      ),
    ),
    "workflow environment",
    "configure Effect synchronization",
  );
  /** @type {import('./dependabot-effect-reference.mjs').GitHubRequest} */
  const request = async (endpoint, body) => {
    const response = await globalThis.fetch(
      `https://api.github.com${endpoint}`,
      {
        ...(body !== undefined && { body: JSON.stringify(body) }),
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "prettier-config-effect-reference",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        method: body === undefined ? "GET" : "POST",
        redirect: "error",
        signal: globalThis.AbortSignal.timeout(30_000),
      },
    );
    if (!response.ok)
      throw new Error(`GitHub ${endpoint}: HTTP ${String(response.status)}`);
    const result = decodeJson(
      Schema.Unknown,
      await response.text(),
      endpoint,
      "read GitHub response",
    );
    if (endpoint === "/graphql") {
      const { errors } = decodeValue(
        errorsSchema,
        result,
        endpoint,
        "read GitHub mutation",
      );
      if (errors?.length)
        throw new Error(errors.map((error) => error.message).join("\n"));
    }
    return result;
  };
  process.stdout.write(
    `${await syncEffectReference({
      branch: environment.EFFECT_PR_BRANCH,
      head: environment.EFFECT_PR_HEAD,
      repository: environment.GITHUB_REPOSITORY,
      request,
    })}\n`,
  );
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
