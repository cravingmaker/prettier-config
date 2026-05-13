/**
 * Global rule overrides (all TypeScript files)
 *
 * functional/no-conditional-statements — disabled because the plugin-loading logic in index.ts
 * uses guard clauses (`if (isInstalled(...))`) that are intentionally one-way side-effectful
 * gates with no else branch. The rule requires every branch to return a value, which is
 * incompatible with this pattern. Rewriting as ternaries would not improve readability here.
 *
 * functional/no-expression-statements — disabled because this codebase contains inherently
 * side-effectful expression statements that cannot be eliminated: the conditional plugin
 * registration in index.ts is expression-based by nature, and all vitest APIs (describe, it,
 * expect, vi.*) are void-returning expression statements — the standard testing pattern.
 */

/**
 * Test-only rule overrides (tests/*.ts)
 *
 * functional/functional-parameters — disabled because vi.doMock() factory functions must match
 * the exact shape of the mocked module's API. The `createRequire` factory `() => ({...})` takes
 * no parameters because that is the signature of Node's createRequire in the mock context.
 * Adding a dummy parameter solely to satisfy this rule would misrepresent the API contract.
 *
 * functional/no-return-void — disabled because all vitest suite and test callbacks (describe,
 * it, beforeEach) are inherently void-returning — they register test cases as side effects
 * rather than producing values. This is the universal pattern for test frameworks and cannot
 * be changed without abandoning vitest's API entirely.
 *
 * functional/no-throw-statements — disabled because mock implementations of require.resolve
 * must throw to simulate "module not found" errors, which is the exact behaviour that Node's
 * require.resolve exhibits when a module cannot be resolved. Using a return value instead would
 * not correctly simulate the error path that the isInstalled helper in index.ts catches.
 */

import { createConfig } from '@cravingmaker/eslint-config';

const baseConfig = await createConfig({
	ignores: ['tests/fixtures/**/*'],
	rules: {
		ts: {
			'functional/no-conditional-statements': 'off',
			'functional/no-expression-statements': 'off',
		},
	},
});

const config = [
	...baseConfig,
	{
		files: ['tests/**/*.ts'],
		rules: {
			'functional/functional-parameters': 'off',
			'functional/no-return-void': 'off',
			'functional/no-throw-statements': 'off',
		},
	},
];

// eslint-disable-next-line import-x/no-default-export -- ESLint configuration requires a default export
export default config;
