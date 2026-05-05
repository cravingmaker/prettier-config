import type { Config } from 'prettier';

import { createRequire } from 'node:module';
import prettierPluginOxc from '@prettier/plugin-oxc';

const require = createRequire(import.meta.url);

const isInstalled = (name: string) => {
	try {
		require.resolve(name);
		return true;
	} catch {
		return false;
	}
};

const plugins = [prettierPluginOxc, 'prettier-plugin-packagejson'];

if (isInstalled('astro')) {
	plugins.push('prettier-plugin-astro');
}

if (isInstalled('svelte')) {
	plugins.push('prettier-plugin-svelte');
}

// Tailwind plugin should always be last
if (isInstalled('tailwindcss')) {
	plugins.push('prettier-plugin-tailwindcss');
}

const config: Config = {
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
	plugins,
	printWidth: 120,
	singleAttributePerLine: true,
	singleQuote: true,
	tabWidth: 2,
	useTabs: true,
};

// eslint-disable-next-line import-x/no-default-export -- Prettier configuration is typically exported as a default export
export default config;
