import { Context, Effect, Layer } from "effect";
import { layer } from "@effect/vitest";
import { expect } from "vitest";

import {
  consumerNode,
  PackageSmoke,
  packageSmokeLayer,
} from "./helpers/package-smoke.js";
import packageJson from "../package.json" with { type: "json" };

const requiredDependencies = [
  "prettier",
  "prettier-plugin-packagejson",
  "prettier-plugin-toml",
  "@prettier/plugin-oxc",
  "@prettier/plugin-xml",
] as const;
const optionalDependencies = [
  `prettier-plugin-astro@${packageJson.devDependencies["prettier-plugin-astro"]}`,
  `prettier-plugin-svelte@${packageJson.devDependencies["prettier-plugin-svelte"]}`,
  `prettier-plugin-tailwindcss@${packageJson.devDependencies["prettier-plugin-tailwindcss"]}`,
  `svelte@${packageJson.devDependencies.svelte}`,
] as const;

class OptionalConsumer extends Context.Service<OptionalConsumer, string>()(
  "prettier-config/tests/OptionalConsumer",
) {}
const optionalConsumerLayer = Layer.effect(
  OptionalConsumer,
  Effect.gen(function* () {
    const smoke = yield* PackageSmoke;
    const consumer = yield* smoke.installConsumer(
      "installed-optional-consumer",
      optionalDependencies,
    );
    yield* smoke.copyFixtures(
      consumer,
      ["tests", "fixtures"],
      ["tailwind.vue", "tailwind.css", "tailwind.scss", "tailwind.less"],
    );
    return consumer;
  }),
);

layer(packageSmokeLayer, { excludeTestServices: true, timeout: "60 seconds" })(
  "Published Package",
  (it) => {
    it.effect(
      "ships the runtime and public types without build artifacts",
      () =>
        Effect.gen(function* () {
          const smoke = yield* PackageSmoke;
          const output = yield* smoke.run({
            args: ["-tzf", smoke.tarball],
            cwd: smoke.workspace,
            executable: "tar",
            phase: "list tarball",
            timeoutMs: 30_000,
          });
          const entries = output.trim().split("\n");
          expect(entries).toHaveLength(5);
          expect(entries).toEqual(
            expect.arrayContaining([
              "package/LICENSE",
              "package/README.md",
              "package/index.d.ts",
              "package/index.mjs",
              "package/package.json",
            ]),
          );
        }),
      60_000,
    );

    it.effect(
      "installs the tarball and consumes its runtime and public types",
      () =>
        Effect.gen(function* () {
          const smoke = yield* PackageSmoke;
          const consumer = yield* smoke.installConsumer("installed-consumer", [
            `typescript@${packageJson.devDependencies.typescript}`,
          ]);
          expect(yield* smoke.isInstalledPackageSymlink(consumer)).toBe(false);
          yield* smoke.copyFixtures(
            consumer,
            ["tests", "fixtures", "installed-consumer"],
            ["check.mjs", "typecheck.ts", "tsconfig.json"],
          );
          const output = yield* smoke.run({
            args: ["check.mjs"],
            cwd: consumer,
            executable: consumerNode,
            phase: "check installed runtime",
            timeoutMs: 30_000,
          });
          expect(output).toBe("ok");
          // TypeScript is a development tool; CI selects the minimum Node only for runtime consumers.
          yield* smoke.run({
            args: [
              "node_modules/typescript/bin/tsc",
              "--project",
              "tsconfig.json",
            ],
            cwd: consumer,
            executable: process.execPath,
            phase: "check installed types",
            timeoutMs: 30_000,
          });
        }),
      240_000,
    );

    it.effect.each([false, true])(
      "works without optional plugins (external cwd: %s)",
      (externalCwd) =>
        Effect.gen(function* () {
          const smoke = yield* PackageSmoke;
          const consumer = yield* smoke.createConsumer(
            `base-consumer-${String(externalCwd)}`,
            requiredDependencies,
          );
          expect(
            yield* smoke.runConsumer(consumer, "base.mjs", externalCwd),
          ).toBe("ok");
        }),
      120_000,
    );

    it.layer(optionalConsumerLayer, { timeout: "180 seconds" })(
      "with npm-installed optional plugins",
      (optionalTests) => {
        optionalTests.effect.each([false, true])(
          "loads optional plugins from the consumer (external cwd: %s)",
          (externalCwd) =>
            Effect.gen(function* () {
              const smoke = yield* PackageSmoke;
              const consumer = yield* OptionalConsumer;
              expect(
                yield* smoke.runConsumer(consumer, "optional.mjs", externalCwd),
              ).toBe("ok");
            }),
          60_000,
        );
      },
    );
  },
);
