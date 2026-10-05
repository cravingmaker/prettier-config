// @ts-check

import { createRequire } from 'node:module';

// eslint-disable-next-line import-x/no-rename-default -- Use the plugin name instead of the bundled export identifier
import prettierPluginOxc from '@prettier/plugin-oxc';

const require = createRequire(import.meta.url);

/** @param {string} name */
const resolveOptionalPlugin = (name) => {
	try {
		return [require.resolve(name)];
	} catch (error) {
		// Missing entry points also use MODULE_NOT_FOUND, but Node attaches the installed package path.
		if (error instanceof Error && 'code' in error && error.code === 'MODULE_NOT_FOUND' && !('path' in error)) {
			return [];
		}
		throw error;
	}
};

const plugins = [
	prettierPluginOxc,
	require.resolve('prettier-plugin-packagejson'),
	require.resolve('prettier-plugin-toml'),
	require.resolve('@prettier/plugin-xml'),
	...resolveOptionalPlugin('prettier-plugin-astro'),
	...resolveOptionalPlugin('prettier-plugin-svelte'),
	// Tailwind plugin should always be last
	...resolveOptionalPlugin('prettier-plugin-tailwindcss'),
];

const dataFormatOptions = {
	useTabs: false,
};

/** @satisfies {import('prettier').Config} */
const config = {
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
				...dataFormatOptions,
				singleQuote: false,
				trailingComma: 'none',
			},
		},
		{
			files: ['**/*.{yaml,yml}'],
			options: {
				...dataFormatOptions,
				singleQuote: false,
			},
		},
		{
			files: ['**/*.toml'],
			options: {
				...dataFormatOptions,
				keyQuoteStyle: 'double',
				stringQuoteStyle: 'double',
			},
		},
		{
			files: ['**/*.xml'],
			options: {
				...dataFormatOptions,
				xmlQuoteAttributes: 'double',
				xmlWhitespaceSensitivity: 'preserve',
			},
		},
		{
			files: ['**/*.{md,mdx}'],
			options: {
				printWidth: 80,
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
