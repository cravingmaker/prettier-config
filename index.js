import prettierPluginOxc from '@prettier/plugin-oxc';

/** @type {import("prettier").Config} */
const config = {
	// Defaults
	arrowParens: 'always',
	bracketSameLine: false,
	bracketSpacing: true,
	embeddedLanguageFormatting: 'auto',
	endOfLine: 'lf',
	htmlWhitespaceSensitivity: 'css',
	objectWrap: 'preserve',
	proseWrap: 'preserve',
	quoteProps: 'as-needed',
	semi: true,
	trailingComma: 'all',
	vueIndentScriptAndStyle: false,

	// Overrides
	jsxSingleQuote: true,
	printWidth: 120,
	singleAttributePerLine: true,
	singleQuote: true,
	tabWidth: 2,
	useTabs: true,

	// OXC plugin
	plugins: [prettierPluginOxc],
	overrides: [
		{
			files: ['**/*.{js,cjs,mjs,jsx}'],
			options: { parser: 'oxc' },
		},
		{
			files: ['**/*.{ts,cts,mts,tsx}'],
			options: { parser: 'oxc-ts' },
		},
	],
};

export default config;
