import type { Config } from 'prettier';

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
		// @ts-expect-error - cache busting query string
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- The dynamic import return type is 'any' due to the query string, but we know it's our Prettier config; the ?query suffix is intentional for Vitest module cache-busting
		const { default: config } = (await import('../index.mjs?default')) as { default: Config };
		expect(config.plugins).toContain(prettierPluginOxc);
		expect(config.plugins).toContain(require.resolve('prettier-plugin-packagejson'));
		expect(config.plugins).toContain(require.resolve('prettier-plugin-toml'));
		expect(config.jsxSingleQuote).toBeUndefined();
	});

	it('should include astro plugin if prettier-plugin-astro is installed', async () => {
		vi.doMock('node:module', () => ({
			createRequire: () => ({
				resolve(name: string) {
					if (name === 'prettier-plugin-packagejson') return '/plugins/packagejson.cjs';
					if (name === 'prettier-plugin-toml') return '/plugins/toml.mjs';
					if (name === 'prettier-plugin-astro') return '/plugins/astro.mjs';
					throw Object.assign(new Error('Not found'), { code: 'MODULE_NOT_FOUND' });
				},
			}),
		}));

		// @ts-expect-error - cache busting query string
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- The dynamic import return type is 'any' due to the query string, but we know it's our Prettier config; the ?query suffix is intentional for Vitest module cache-busting
		const { default: config } = (await import('../index.mjs?astro')) as { default: Config };
		expect(config.plugins).toContain('/plugins/astro.mjs');
	});

	it('should include svelte plugin if prettier-plugin-svelte is installed', async () => {
		vi.doMock('node:module', () => ({
			createRequire: () => ({
				resolve(name: string) {
					if (name === 'prettier-plugin-packagejson') return '/plugins/packagejson.cjs';
					if (name === 'prettier-plugin-toml') return '/plugins/toml.mjs';
					if (name === 'prettier-plugin-svelte') return '/plugins/svelte.mjs';
					throw Object.assign(new Error('Not found'), { code: 'MODULE_NOT_FOUND' });
				},
			}),
		}));

		// @ts-expect-error - cache busting query string
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- The dynamic import return type is 'any' due to the query string, but we know it's our Prettier config; the ?query suffix is intentional for Vitest module cache-busting
		const { default: config } = (await import('../index.mjs?svelte')) as { default: Config };
		expect(config.plugins).toContain('/plugins/svelte.mjs');
	});

	it('should include tailwind plugin last if installed', async () => {
		vi.doMock('node:module', () => ({
			createRequire: () => ({
				resolve(name: string) {
					if (name === 'prettier-plugin-packagejson') return '/plugins/packagejson.cjs';
					if (name === 'prettier-plugin-toml') return '/plugins/toml.mjs';
					if (name === 'prettier-plugin-astro') return '/plugins/astro.mjs';
					if (name === 'prettier-plugin-svelte') return '/plugins/svelte.mjs';
					if (name === 'prettier-plugin-tailwindcss') return '/plugins/tailwindcss.mjs';
					throw Object.assign(new Error('Not found'), { code: 'MODULE_NOT_FOUND' });
				},
			}),
		}));

		// @ts-expect-error - cache busting query string
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- The dynamic import return type is 'any' due to the query string, but we know it's our Prettier config; the ?query suffix is intentional for Vitest module cache-busting
		const { default: config } = (await import('../index.mjs?tailwind')) as {
			default: Config;
		};

		const plugins = config.plugins ?? [];

		expect(plugins).toContain('/plugins/astro.mjs');
		expect(plugins).toContain('/plugins/svelte.mjs');
		expect(plugins.at(-1)).toBe('/plugins/tailwindcss.mjs');
	});

	it('should not include optional plugins when they are not installed', async () => {
		vi.doMock('node:module', () => ({
			createRequire: () => ({
				resolve(name: string) {
					if (name === 'prettier-plugin-packagejson') return '/plugins/packagejson.cjs';
					if (name === 'prettier-plugin-toml') return '/plugins/toml.mjs';
					throw Object.assign(new Error('Not found'), { code: 'MODULE_NOT_FOUND' });
				},
			}),
		}));

		// @ts-expect-error - cache busting query string
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- The dynamic import return type is 'any' due to the query string, but we know it's our Prettier config; the ?query suffix is intentional for Vitest module cache-busting
		const { default: config } = (await import('../index.mjs?no-optional')) as {
			default: Config;
		};

		expect(config.plugins).not.toContain('/plugins/astro.mjs');
		expect(config.plugins).not.toContain('/plugins/svelte.mjs');
		expect(config.plugins).not.toContain('/plugins/tailwindcss.mjs');
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
