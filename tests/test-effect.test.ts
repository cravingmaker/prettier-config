import { setTimeout as delay } from "node:timers/promises";

import { Deferred, Effect, Layer, ManagedRuntime } from "effect";
import { describe, expect, it, vi } from "vitest";

import { nodeFileSystem } from "./helpers/node-files.js";
import { createPackageSmoke, PackageSmoke } from "./helpers/package-smoke.js";
import { runEffect } from "./helpers/test-effect.js";

describe("stable Effect integration with Vitest", () => {
  it("awaits scope cleanup when Vitest aborts a running test", async () => {
    const controller = new AbortController();
    const onTestFinished = vi.fn<(cleanup: () => Promise<void>) => void>();
    const released = vi.fn();
    const acquired = await Effect.runPromise(Deferred.make<boolean>());
    const release = Effect.promise(async () => {
      await delay(10);
      released();
    });
    const pending = runEffect(
      { onTestFinished, signal: controller.signal },
      Effect.gen(function* () {
        yield* Effect.acquireRelease(
          Deferred.succeed(acquired, true),
          () => release,
        );
        return yield* Effect.never;
      }),
    );
    const outcome = (async () => {
      try {
        await pending;
        return "resolved";
      } catch {
        return "rejected";
      }
    })();
    await Effect.runPromise(Deferred.await(acquired));
    controller.abort();
    const cleanup = onTestFinished.mock.calls[0]?.[0];
    expect(cleanup).toBeDefined();
    await cleanup?.();
    expect(await outcome).toBe("rejected");
    expect(released).toHaveBeenCalledOnce();
  });

  it("shares one workspace between runtimes and removes it after the last release", async () => {
    const pack = vi.fn((workspace: string) =>
      nodeFileSystem
        .writeFileString(`${workspace}/package.tgz`, "archive")
        .pipe(Effect.orDie),
    );
    const layer = Layer.effect(PackageSmoke, createPackageSmoke(pack));
    const parent = ManagedRuntime.make(layer);
    const child = ManagedRuntime.make(layer, { memoMap: parent.memoMap });
    const workspace = await (async () => {
      try {
        const original = await parent.runPromise(PackageSmoke);
        const shared = await child.runPromise(PackageSmoke);
        expect(shared.workspace).toBe(original.workspace);
        expect(pack).toHaveBeenCalledOnce();
        await child.dispose();
        expect(
          await Effect.runPromise(nodeFileSystem.exists(original.workspace)),
        ).toBe(true);
        return original.workspace;
      } finally {
        await child.dispose();
        await parent.dispose();
      }
    })();
    expect(await Effect.runPromise(nodeFileSystem.exists(workspace))).toBe(
      false,
    );
  });
});
