import { describe, expect, it } from "vitest";

import { decodeJson, packageManifestSchema } from "../scripts/manifest.mjs";

describe("external manifests", () => {
  it("decodes the fields used by source verification", () => {
    expect(
      decodeJson(
        packageManifestSchema,
        '{"name":"effect","version":"4.0.0","unused":true}',
        "package.json",
        "verify package",
      ),
    ).toEqual({ name: "effect", version: "4.0.0" });
  });

  it.each(["{", "null", '{"name":"effect"}', '{"name":"effect","version":4}'])(
    "reports malformed data with file and phase context: %s",
    (contents) => {
      expect(() =>
        decodeJson(
          packageManifestSchema,
          contents,
          "packages/effect/package.json",
          "verify reference package",
        ),
      ).toThrow(
        "verify reference package: invalid JSON data in packages/effect/package.json",
      );
    },
  );
});
