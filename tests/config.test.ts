import { createRequire } from 'node:module';

import prettierPluginOxc from '@prettier/plugin-oxc';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);

describe('Prettier Config', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.doUnmock('node:module');
	});

	it('should include basic plugins by default', async () => {
		const { default: config } = await import('../index.mjs');
		expect(config.plugins).toContain(prettierPluginOxc);
		expect(config.plugins).toContain(require.resolve('prettier-plugin-packagejson'));
		expect(config.plugins).toContain(require.resolve('prettier-plugin-toml'));
		expect(config.plugins).toContain(require.resolve('@prettier/plugin-xml'));
		expect(config).not.toHaveProperty('jsxSingleQuote');
		expect(config.tabWidth).toBe(2);

		const tomlOverride = config.overrides.find((override) => override.files.includes('**/*.toml'));
		expect(tomlOverride?.options).not.toHaveProperty('tabWidth');
	});

	it.each([
		{ installed: [], label: 'none' },
		{ installed: ['astro'], label: 'Astro' },
		{ installed: ['svelte'], label: 'Svelte' },
		{ installed: ['tailwindcss'], label: 'Tailwind' },
		{ installed: ['astro', 'svelte'], label: 'Astro and Svelte' },
		{ installed: ['astro', 'tailwindcss'], label: 'Astro and Tailwind' },
		{ installed: ['svelte', 'tailwindcss'], label: 'Svelte and Tailwind' },
		{ installed: ['astro', 'svelte', 'tailwindcss'], label: 'all' },
	])('includes exactly the installed optional plugins in order: $label', async ({ installed }) => {
		vi.doMock('node:module', () => ({
			createRequire: () => ({
				resolve(name: string) {
					if (name === 'prettier-plugin-packagejson') return '/plugins/packagejson.cjs';
					if (name === 'prettier-plugin-toml') return '/plugins/toml.mjs';
					if (name === '@prettier/plugin-xml') return '/plugins/xml.mjs';
					if (installed.some((plugin) => name === `prettier-plugin-${plugin}`)) {
						return `/plugins/${name}.mjs`;
					}
					throw Object.assign(new Error('Not found'), { code: 'MODULE_NOT_FOUND' });
				},
			}),
		}));

		const { default: config } = await import('../index.mjs');

		expect(config.plugins).toEqual([
			prettierPluginOxc,
			'/plugins/packagejson.cjs',
			'/plugins/toml.mjs',
			'/plugins/xml.mjs',
			...installed.map((plugin) => `/plugins/prettier-plugin-${plugin}.mjs`),
		]);
	});

	it.each([
		{ code: 'ERR_INVALID_PACKAGE_CONFIG', label: 'invalid package metadata' },
		{ code: 'ERR_PACKAGE_PATH_NOT_EXPORTED', label: 'inaccessible package exports' },
		{ code: 'EACCES', label: 'filesystem permission failures' },
		{ code: undefined, label: 'unexpected resolver errors' },
	])('preserves the original error for $label', async ({ code }) => {
		const failure = Object.assign(new Error('Cannot resolve optional plugin'), { code });
		vi.doMock('node:module', () => ({
			createRequire: () => ({
				resolve(name: string) {
					if (name === 'prettier-plugin-astro') throw failure;
					return `/plugins/${name}.mjs`;
				},
			}),
		}));

		await expect(import('../index.mjs')).rejects.toBe(failure);
	});

	it.each(['prettier-plugin-astro', 'prettier-plugin-svelte', 'prettier-plugin-tailwindcss'])(
		'preserves MODULE_NOT_FOUND when %s has a broken entry point',
		async (plugin) => {
			const failure = Object.assign(new Error('Cannot find the installed plugin entry point'), {
				code: 'MODULE_NOT_FOUND',
				path: `/plugins/${plugin}/package.json`,
			});
			vi.doMock('node:module', () => ({
				createRequire: () => ({
					resolve(name: string) {
						if (name === plugin) throw failure;
						return `/plugins/${name}.mjs`;
					},
				}),
			}));

			await expect(import('../index.mjs')).rejects.toBe(failure);
		},
	);
});
