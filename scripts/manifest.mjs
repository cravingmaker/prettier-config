import { Schema } from "effect";

/**
 * Decode external JSON through a stable schema and retain file/phase context.
 * @template {import('effect/Schema').Constraint & { readonly DecodingServices: never }} S
 * @param {S} schema
 * @param {string} contents
 * @param {string} filename
 * @param {string} phase
 */
const decodeJson = (schema, contents, filename, phase) => {
  try {
    // eslint-disable-next-line n/no-sync -- Schema decoding is pure and performs no synchronous I/O.
    return Schema.decodeUnknownSync(Schema.fromJsonString(schema))(contents);
  } catch (error) {
    throw new Error(
      `${phase}: invalid JSON data in ${filename}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
};

const packageManifestSchema = Schema.Struct({
  name: Schema.String,
  version: Schema.String,
});

export { decodeJson, packageManifestSchema };
