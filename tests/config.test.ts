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
	});

	it('should include astro plugin if prettier-plugin-astro is installed', async () => {
		vi.doMock('node:module', () => ({
			createRequire: () => ({
				resolve(name: string) {
					if (name === 'prettier-plugin-packagejson') return '/plugins/packagejson.cjs';
					if (name === 'prettier-plugin-toml') return '/plugins/toml.mjs';
					if (name === 'prettier-plugin-astro') return '/plugins/astro.mjs';
					throw new Error('Not found');
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
					throw new Error('Not found');
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
					throw new Error('Not found');
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
					throw new Error('Not found');
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
});
