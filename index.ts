import prettierPluginOxc from '@prettier/plugin-oxc';
import type { Config } from 'prettier';

const config: Config = {
	jsxSingleQuote: true,
	printWidth: 120,
	singleAttributePerLine: true,
	singleQuote: true,
	tabWidth: 2,
	useTabs: true,

	plugins: [prettierPluginOxc, 'prettier-plugin-packagejson', 'prettier-plugin-astro', 'prettier-plugin-svelte'],

	overrides: [
		{
			files: ['**/*.{ts,cts,mts,tsx}'],
			options: { parser: 'oxc-ts' },
		},
		{
			files: ['**/*.{js,cjs,mjs,jsx}'],
			options: { parser: 'oxc' },
		},
		{
			files: '**/*.astro',
			options: { parser: 'astro' },
		},
		{
			files: '**/*.svelte',
			options: {
				parser: 'svelte',
				svelteAllowShorthand: false,
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
			files: ['**/*.html'],
			options: {
				singleQuote: false,
				useTabs: false,
			},
		},
		{
			files: ['**/*.md'],
			options: {
				printWidth: 80,
				singleQuote: false,
				trailingComma: 'none',
				useTabs: false,
			},
		},
		{
			files: ['package.json', 'package-lock.json'],
			options: {
				printWidth: 80,
				singleQuote: false,
				trailingComma: 'none',
				useTabs: false,
			},
		},
	],
};

export default config;
