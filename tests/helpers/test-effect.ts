import type { ManagedRuntime, Scope } from "effect";

import { Effect } from "effect";

type TestLifetime = {
  readonly onTestFinished: (cleanup: () => Promise<void>) => void;
  readonly signal: AbortSignal;
};

const withTestLifetime = async <A>(
  context: TestLifetime,
  start: (signal: AbortSignal) => Promise<A>,
) => {
  const result = start(context.signal);
  // Vitest can report a timeout before the interrupted fiber finishes cleanup.
  context.onTestFinished(async () => {
    await result.catch(() => {
      // The returned test promise already reports the failure.
    });
  });
  return await result;
};

const runEffect = async <A, E>(
  context: TestLifetime,
  effect: Effect.Effect<A, E, Scope.Scope>,
) =>
  await withTestLifetime(
    context,
    async (signal) =>
      await Effect.runPromise(Effect.scoped(effect), { signal }),
  );

const runRuntimeEffect = async <A, E, R, ER>(
  context: TestLifetime,
  runtime: ManagedRuntime.ManagedRuntime<R, ER>,
  effect: Effect.Effect<A, E, R | Scope.Scope>,
) =>
  await withTestLifetime(
    context,
    async (signal) =>
      await runtime.runPromise(Effect.scoped(effect), { signal }),
  );

export { runEffect, runRuntimeEffect };
