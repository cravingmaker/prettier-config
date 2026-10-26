import { Context, Effect, Layer, ManagedRuntime } from "effect";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { consumerNode, PackageSmoke, packageSmokeLayer } from "./helpers/package-smoke.js";
import { peerScenario } from "./helpers/peer-scenarios.js";
import { runRuntimeEffect } from "./helpers/test-effect.js";
import packageJson from "../package.json" with { type: "json" };

class BaseConsumer extends Context.Service<BaseConsumer, string>()("prettier-config/tests/BaseConsumer") {}
const baseConsumerLayer = Layer.effect(
  BaseConsumer,
  Effect.gen(function* () {
    const smoke = yield* PackageSmoke;
    const consumer = yield* smoke.installConsumer("installed-consumer", [`typescript@${packageJson.devDependencies.typescript}`]);
    yield* smoke.copyFixtures(consumer, ["tests", "consumers"], ["resolution.mjs"]);
    yield* smoke.copyFixtures(consumer, ["tests", "fixtures", "installed-consumer"], ["typecheck.ts", "tsconfig.json"]);
    return consumer;
  }),
);

class OptionalConsumer extends Context.Service<OptionalConsumer, string>()("prettier-config/tests/OptionalConsumer") {}
const optionalConsumerLayer = Layer.effect(
  OptionalConsumer,
  Effect.gen(function* () {
    const smoke = yield* PackageSmoke;
    const consumer = yield* smoke.installConsumer("installed-optional-consumer", peerScenario.optionalDependencies);
    yield* smoke.copyFixtures(consumer, ["tests", "fixtures"], ["tailwind.vue", "tailwind.css", "tailwind.scss", "tailwind.less"]);
    yield* smoke.copyFixtures(consumer, ["tests", "consumers"], ["tailwind-config.mjs"]);
    yield* smoke.copyFixtures(consumer, ["tests", "fixtures", "tailwind-stylesheet"], ["theme.css"]);
    return consumer;
  }),
);

// eslint-disable-next-line max-lines-per-function -- The suite registers consumers under one shared installation lifetime.
describe(`Published Package (${peerScenario.name} peers, Prettier ${peerScenario.prettier})`, () => {
  const runtime = ManagedRuntime.make(packageSmokeLayer);
  beforeAll(async () => {
    await runtime.runPromise(Effect.void);
  }, 60_000);
  afterAll(async () => {
    await runtime.dispose();
  }, 30_000);
  it("ships the runtime and public types without build artifacts", async (context) => {
    await runRuntimeEffect(
      context,
      runtime,
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
          expect.arrayContaining(["package/LICENSE", "package/README.md", "package/index.d.ts", "package/index.mjs", "package/package.json"]),
        );
      }),
    );
  }, 60_000);

  describe("with an npm-installed base consumer", () => {
    const baseRuntime = ManagedRuntime.make(baseConsumerLayer.pipe(Layer.provideMerge(packageSmokeLayer)), {
      memoMap: runtime.memoMap,
    });
    beforeAll(async () => {
      await baseRuntime.runPromise(Effect.void);
    }, 180_000);
    afterAll(async () => {
      await baseRuntime.dispose();
    }, 30_000);
    it("installs a real package and checks optional resolution and public types", async (context) => {
      await runRuntimeEffect(
        context,
        baseRuntime,
        Effect.gen(function* () {
          const smoke = yield* PackageSmoke;
          const consumer = yield* BaseConsumer;
          expect(yield* smoke.checkInstalledPackageSymlink(consumer)).toBe(false);
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
            args: ["node_modules/typescript/bin/tsc", "--project", "tsconfig.json"],
            cwd: consumer,
            executable: process.execPath,
            phase: "check installed types",
            timeoutMs: 30_000,
          });
        }),
      );
    }, 60_000);
    it.for([false, true])(
      "retains base formatting without optional plugins (external cwd: %s)",
      { timeout: 60_000 },
      async (externalCwd, context) => {
        await runRuntimeEffect(
          context,
          baseRuntime,
          Effect.gen(function* () {
            const smoke = yield* PackageSmoke;
            const consumer = yield* BaseConsumer;
            expect(yield* smoke.runConsumer(consumer, "installed.mjs", externalCwd)).toBe("ok");
          }),
        );
      },
    );
  });

  describe("with npm-installed optional plugins", () => {
    const optionalRuntime = ManagedRuntime.make(optionalConsumerLayer.pipe(Layer.provideMerge(packageSmokeLayer)), {
      memoMap: runtime.memoMap,
    });
    beforeAll(async () => {
      await optionalRuntime.runPromise(Effect.void);
    }, 180_000);
    afterAll(async () => {
      await optionalRuntime.dispose();
    }, 30_000);
    it.for([false, true])(
      "resolves custom Tailwind stylesheet relative to config (external cwd: %s)",
      { timeout: 60_000 },
      async (externalCwd, context) => {
        await runRuntimeEffect(
          context,
          optionalRuntime,
          Effect.gen(function* () {
            const smoke = yield* PackageSmoke;
            const consumer = yield* OptionalConsumer;
            expect(yield* smoke.runConsumer(consumer, "tailwind.mjs", externalCwd)).toBe("ok");
          }),
        );
      },
    );
    it.for([false, true])("loads optional plugins from the consumer (external cwd: %s)", { timeout: 60_000 }, async (externalCwd, context) => {
      await runRuntimeEffect(
        context,
        optionalRuntime,
        Effect.gen(function* () {
          const smoke = yield* PackageSmoke;
          const consumer = yield* OptionalConsumer;
          expect(yield* smoke.runConsumer(consumer, "optional.mjs", externalCwd)).toBe("ok");
        }),
      );
    });
  });
});
