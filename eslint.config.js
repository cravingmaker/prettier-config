/**
 * Test-only rule overrides (tests/*.ts)
 *
 * functional/functional-parameters — disabled because vi.doMock() factory functions must match
 * the exact shape of the mocked module's API. Adding dummy parameters solely to satisfy the rule
 * would misrepresent those APIs.
 *
 * functional/no-conditional-statements — disabled because tests intentionally use explicit
 * control flow for assertions, mocks, and failure paths.
 *
 * functional/no-expression-statements and functional/no-return-void — disabled because Vitest
 * APIs such as describe(), it(), expect(), and vi.* register behavior through side effects and
 * void-returning callbacks.
 *
 * functional/no-throw-statements — disabled because mocks and test guards intentionally throw to
 * reproduce Node resolution failures and fail fast on invalid test state.
 */

import { createConfig } from '@cravingmaker/eslint-config';

const baseConfig = await createConfig({
	ignores: ['tests/fixtures/**/*'],
});

const config = [
	...baseConfig,
	{
		linterOptions: {
			reportUnusedDisableDirectives: 'error',
			reportUnusedInlineConfigs: 'error',
		},
	},
	{
		files: ['tests/**/*.ts'],
		rules: {
			'functional/functional-parameters': 'off',
			'functional/no-conditional-statements': 'off',
			'functional/no-expression-statements': 'off',
			'functional/no-return-void': 'off',
			'functional/no-throw-statements': 'off',
		},
	},
	{
		files: ['tests/format.test.ts'],
		rules: {
			'security/detect-non-literal-fs-filename': 'off',
		},
	},
	{
		files: ['tests/package.smoke.test.ts'],
		rules: {
			'functional/no-promise-reject': 'off',
			'n/no-sync': 'off',
			'security/detect-non-literal-fs-filename': 'off',
		},
	},
];

// eslint-disable-next-line import-x/no-default-export -- ESLint configuration requires a default export
export default config;
