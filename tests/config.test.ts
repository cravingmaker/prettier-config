import type { Config } from 'prettier';

import prettierPluginOxc from '@prettier/plugin-oxc';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Prettier Config', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.doUnmock('node:module');
	});

	it('should include basic plugins by default', async () => {
		// @ts-expect-error - cache busting query string
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion, import-x/extensions -- The dynamic import return type is 'any' due to the query string, but we know it's our Prettier config; the ?query suffix is intentional for Vitest module cache-busting
		const { default: config } = (await import('../index.ts?default')) as { default: Config };
		expect(config.plugins).toContain(prettierPluginOxc);
		expect(config.plugins).toContain('prettier-plugin-packagejson');
	});

	it('should include astro plugin if prettier-plugin-astro is installed', async () => {
		vi.doMock('node:module', () => ({
			createRequire: () => ({
				resolve(name: string) {
					if (name === 'prettier-plugin-astro') return true;
					throw new Error('Not found');
				},
			}),
		}));

		// @ts-expect-error - cache busting query string
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion, import-x/extensions -- The dynamic import return type is 'any' due to the query string, but we know it's our Prettier config; the ?query suffix is intentional for Vitest module cache-busting
		const { default: config } = (await import('../index.ts?astro')) as { default: Config };
		expect(config.plugins).toContain('prettier-plugin-astro');
	});

	it('should include svelte plugin if prettier-plugin-svelte is installed', async () => {
		vi.doMock('node:module', () => ({
			createRequire: () => ({
				resolve(name: string) {
					if (name === 'prettier-plugin-svelte') return true;
					throw new Error('Not found');
				},
			}),
		}));

		// @ts-expect-error - cache busting query string
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion, import-x/extensions -- The dynamic import return type is 'any' due to the query string, but we know it's our Prettier config; the ?query suffix is intentional for Vitest module cache-busting
		const { default: config } = (await import('../index.ts?svelte')) as { default: Config };
		expect(config.plugins).toContain('prettier-plugin-svelte');
	});

	it('should include tailwind plugin last if installed', async () => {
		vi.doMock('node:module', () => ({
			createRequire: () => ({
				resolve(name: string) {
					if (name === 'prettier-plugin-astro') return true;
					if (name === 'prettier-plugin-svelte') return true;
					if (name === 'prettier-plugin-tailwindcss') return true;
					throw new Error('Not found');
				},
			}),
		}));

		// @ts-expect-error - cache busting query string
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion, import-x/extensions -- The dynamic import return type is 'any' due to the query string, but we know it's our Prettier config; the ?query suffix is intentional for Vitest module cache-busting
		const { default: config } = (await import('../index.ts?tailwind')) as {
			default: Config;
		};

		const plugins = config.plugins ?? [];

		expect(plugins).toContain('prettier-plugin-astro');
		expect(plugins).toContain('prettier-plugin-svelte');
		expect(plugins.at(-1)).toBe('prettier-plugin-tailwindcss');
	});

	it('should not include optional plugins when they are not installed', async () => {
		vi.doMock('node:module', () => ({
			createRequire: () => ({
				resolve() {
					throw new Error('Not found');
				},
			}),
		}));

		// @ts-expect-error - cache busting query string
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion, import-x/extensions -- The dynamic import return type is 'any' due to the query string, but we know it's our Prettier config; the ?query suffix is intentional for Vitest module cache-busting
		const { default: config } = (await import('../index.ts?no-optional')) as {
			default: Config;
		};

		expect(config.plugins).not.toContain('prettier-plugin-astro');
		expect(config.plugins).not.toContain('prettier-plugin-svelte');
		expect(config.plugins).not.toContain('prettier-plugin-tailwindcss');
	});
});
