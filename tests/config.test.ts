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
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- The dynamic import return type is 'any' due to the query string, but we know it's our Prettier config
		const { default: config } = (await import('../index.ts?default')) as { default: Config };
		expect(config.plugins).toContain(prettierPluginOxc);
		expect(config.plugins).toContain('prettier-plugin-packagejson');
	});

	it('should include astro plugin if astro is installed', async () => {
		vi.doMock('node:module', () => ({
			createRequire: () => ({
				resolve(name: string) {
					if (name === 'astro') return true;
					if (name === 'prettier-plugin-astro') return true;
					throw new Error('Not found');
				},
			}),
		}));

		// @ts-expect-error - cache busting query string
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- The dynamic import return type is 'any' due to the query string, but we know it's our Prettier config
		const { default: config } = (await import('../index.ts?astro')) as { default: Config };
		expect(config.plugins).toContain('prettier-plugin-astro');
	});

	it('should include svelte plugin if svelte is installed', async () => {
		vi.doMock('node:module', () => ({
			createRequire: () => ({
				resolve(name: string) {
					if (name === 'svelte') return true;
					if (name === 'prettier-plugin-svelte') return true;
					throw new Error('Not found');
				},
			}),
		}));

		// @ts-expect-error - cache busting query string
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- The dynamic import return type is 'any' due to the query string, but we know it's our Prettier config
		const { default: config } = (await import('../index.ts?svelte')) as { default: Config };
		expect(config.plugins).toContain('prettier-plugin-svelte');
	});

	it('should include tailwind plugin last if installed', async () => {
		vi.doMock('node:module', () => ({
			createRequire: () => ({
				resolve(name: string) {
					if (name === 'tailwindcss') return true;
					if (name === 'prettier-plugin-tailwindcss') return true;
					if (name === 'astro') return true;
					if (name === 'prettier-plugin-astro') return true;
					throw new Error('Not found');
				},
			}),
		}));

		// @ts-expect-error - cache busting query string
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- The dynamic import return type is 'any' due to the query string, but we know it's our Prettier config
		const { default: config } = (await import('../index.ts?tailwind')) as { default: Config };
		const plugins = config.plugins ?? [];
		const lastPlugin = plugins[plugins.length - 1];
		expect(lastPlugin).toBe('prettier-plugin-tailwindcss');
	});
});
