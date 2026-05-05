import { createConfig } from '@cravingmaker/eslint-config';

// eslint-disable-next-line import-x/no-default-export -- ESLint configuration requires a default export
export default createConfig({
	ignores: ['tests/fixtures/**/*'],
	jsonRules: {
		'json/sort-keys': 'off',
	},
	tsRules: {
		'import-x/extensions': 'off',
		'require-unicode-regexp': 'off',
	},
});
