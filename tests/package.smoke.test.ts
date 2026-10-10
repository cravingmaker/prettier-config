import { Context, Effect, Layer } from "effect";
import { layer } from "@effect/vitest";
import { expect } from "vitest";

import {
  consumerNode,
  PackageSmoke,
  packageSmokeLayer,
} from "./helpers/package-smoke.js";
import { peerScenario } from "./helpers/peer-scenarios.js";
import packageJson from "../package.json" with { type: "json" };

class BaseConsumer extends Context.Service<BaseConsumer, string>()(
  "prettier-config/tests/BaseConsumer",
) {}
const baseConsumerLayer = Layer.effect(
  BaseConsumer,
  Effect.gen(function* () {
    const smoke = yield* PackageSmoke;
    const consumer = yield* smoke.installConsumer("installed-consumer", [
      `typescript@${packageJson.devDependencies.typescript}`,
    ]);
    yield* smoke.copyFixtures(
      consumer,
      ["tests", "consumers"],
      ["resolution.mjs"],
    );
    yield* smoke.copyFixtures(
      consumer,
      ["tests", "fixtures", "installed-consumer"],
      ["typecheck.ts", "tsconfig.json"],
    );
    return consumer;
  }),
);

class OptionalConsumer extends Context.Service<OptionalConsumer, string>()(
  "prettier-config/tests/OptionalConsumer",
) {}
const optionalConsumerLayer = Layer.effect(
  OptionalConsumer,
  Effect.gen(function* () {
    const smoke = yield* PackageSmoke;
    const consumer = yield* smoke.installConsumer(
      "installed-optional-consumer",
      peerScenario.optionalDependencies,
    );
    yield* smoke.copyFixtures(
      consumer,
      ["tests", "fixtures"],
      ["tailwind.vue", "tailwind.css", "tailwind.scss", "tailwind.less"],
    );
    yield* smoke.copyFixtures(
      consumer,
      ["tests", "consumers"],
      ["tailwind-config.mjs"],
    );
    yield* smoke.copyFixtures(
      consumer,
      ["tests", "fixtures", "tailwind-stylesheet"],
      ["theme.css"],
    );
    return consumer;
  }),
);

layer(packageSmokeLayer, { excludeTestServices: true, timeout: "60 seconds" })(
  `Published Package (${peerScenario.name} peers, Prettier ${peerScenario.prettier})`,
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

    it.layer(baseConsumerLayer, { timeout: "180 seconds" })(
      "with an npm-installed base consumer",
      (baseTests) => {
        baseTests.effect(
          "installs a real package and checks optional resolution and public types",
          () =>
            Effect.gen(function* () {
              const smoke = yield* PackageSmoke;
              const consumer = yield* BaseConsumer;
              expect(yield* smoke.isInstalledPackageSymlink(consumer)).toBe(
                false,
              );
              expect(
                yield* smoke.run({
                  args: ["resolution.mjs"],
                  cwd: consumer,
                  executable: consumerNode,
                  phase: "check optional resolution",
                  timeoutMs: 30_000,
                }),
              ).toBe("ok");
              // TypeScript runs on the development runtime; only consumers select the minimum Node.
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
          60_000,
        );
        baseTests.effect.each([false, true])(
          "retains base formatting without optional plugins (external cwd: %s)",
          (externalCwd) =>
            Effect.gen(function* () {
              const smoke = yield* PackageSmoke;
              const consumer = yield* BaseConsumer;
              expect(
                yield* smoke.runConsumer(
                  consumer,
                  "installed.mjs",
                  externalCwd,
                ),
              ).toBe("ok");
            }),
          60_000,
        );
      },
    );

    it.layer(optionalConsumerLayer, { timeout: "180 seconds" })(
      "with npm-installed optional plugins",
      (optionalTests) => {
        optionalTests.effect.each([false, true])(
          "resolves custom Tailwind stylesheet relative to config (external cwd: %s)",
          (externalCwd) =>
            Effect.gen(function* () {
              const smoke = yield* PackageSmoke;
              const consumer = yield* OptionalConsumer;
              expect(
                yield* smoke.runConsumer(consumer, "tailwind.mjs", externalCwd),
              ).toBe("ok");
            }),
          60_000,
        );
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
