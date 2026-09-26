// @ts-check

import { createRequire } from 'node:module';

// eslint-disable-next-line import-x/no-rename-default -- Use the plugin name instead of the bundled export identifier
import prettierPluginOxc from '@prettier/plugin-oxc';

const require = createRequire(import.meta.url);

/** @param {string} name */
const isInstalled = (name) => {
	try {
		return Boolean(require.resolve(name));
	} catch {
		return false;
	}
};

const plugins = [
	prettierPluginOxc,
	'prettier-plugin-packagejson',
	...(isInstalled('prettier-plugin-astro') ? ['prettier-plugin-astro'] : []),
	...(isInstalled('prettier-plugin-svelte') ? ['prettier-plugin-svelte'] : []),
	// Tailwind plugin should always be last
	...(isInstalled('prettier-plugin-tailwindcss') ? ['prettier-plugin-tailwindcss'] : []),
];

/** @satisfies {import('prettier').Config} */
const config = {
	jsxSingleQuote: true,
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
			files: ['**/*.{json,jsonc,json5}'],
			options: {
				singleQuote: false,
				trailingComma: 'none',
				useTabs: false,
			},
		},
		{
			files: ['**/*.{yaml,yml}'],
			options: {
				useTabs: false,
			},
		},
		{
			files: ['**/*.{md,mdx}'],
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
	plugins,
	printWidth: 120,
	singleAttributePerLine: true,
	singleQuote: true,
	tabWidth: 2,
	useTabs: true,
};

// eslint-disable-next-line import-x/no-default-export -- Prettier configuration is typically exported as a default export
export default config;
