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

	plugins: [prettierPluginOxc, 'prettier-plugin-packagejson'],

	overrides: [
		{
			files: ['package.json', 'package-lock.json'],
			options: {
				printWidth: 80,
				singleQuote: false,
				trailingComma: 'none',
				useTabs: false,
			},
		},
		{
			files: ['**/*.html'],
			options: {
				singleQuote: false,
				useTabs: false,
			},
		},
		{
			files: ['**/*.{css,scss,less}'],
			options: {
				singleQuote: false,
				useTabs: false,
			},
		},
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
