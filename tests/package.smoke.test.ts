import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

const projectDirectory = path.resolve(__dirname, '..');

const requiredDependencies = ['prettier', 'prettier-plugin-packagejson', '@prettier/plugin-oxc'] as const;

const optionalDependencies = [
	'prettier-plugin-astro',
	'prettier-plugin-svelte',
	'prettier-plugin-tailwindcss',
	'svelte',
] as const;

const runConsumer = (consumerDirectory: string, script: string) =>
	execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
		cwd: consumerDirectory,
		encoding: 'utf8',
	});

const createPackedPackage = async () => {
	const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'prettier-config-package-'));

	execFileSync('npm', ['pack', '--ignore-scripts', '--pack-destination', temporaryDirectory], {
		cwd: projectDirectory,
		encoding: 'utf8',
	});

	const packedFiles = await fs.readdir(temporaryDirectory);
	const tarballs = packedFiles.filter((file) => file.endsWith('.tgz'));
	const [tarballFilename] = tarballs;

	if (tarballs.length !== 1 || tarballFilename === undefined) {
		throw new Error(`Expected exactly one packed tarball, found ${tarballs.length}`);
	}

	return {
		tarball: path.join(temporaryDirectory, tarballFilename),
		temporaryDirectory,
	};
};

const { tarball, temporaryDirectory } = await createPackedPackage();

describe('Published Package', () => {
	afterAll(async () => {
		await fs.rm(temporaryDirectory, {
			force: true,
			recursive: true,
		});
	});

	const linkDependency = async (nodeModulesDirectory: string, dependency: string) => {
		const source = path.join(projectDirectory, 'node_modules', dependency);
		const destination = path.join(nodeModulesDirectory, dependency);

		await fs.mkdir(path.dirname(destination), {
			recursive: true,
		});

		await fs.symlink(source, destination, 'junction');
	};

	const createConsumer = async (name: string, dependencies: readonly string[]) => {
		const consumerDirectory = path.join(temporaryDirectory, name);
		const nodeModulesDirectory = path.join(consumerDirectory, 'node_modules');
		const packageDirectory = path.join(nodeModulesDirectory, '@cravingmaker', 'prettier-config');

		await fs.mkdir(packageDirectory, {
			recursive: true,
		});

		execFileSync('tar', ['-xzf', tarball, '--strip-components=1', '-C', packageDirectory], {
			cwd: temporaryDirectory,
		});

		await Promise.all(
			dependencies.map(async (dependency) => {
				await linkDependency(nodeModulesDirectory, dependency);
			}),
		);

		await fs.writeFile(
			path.join(consumerDirectory, 'package.json'),
			JSON.stringify({
				name: `prettier-config-${name}`,
				prettier: '@cravingmaker/prettier-config',
				private: true,
				type: 'module',
			}),
			'utf8',
		);

		return consumerDirectory;
	};

	it('works from the packed tarball without optional plugins', async () => {
		const consumerDirectory = await createConsumer('base-consumer', requiredDependencies);

		const output = runConsumer(
			consumerDirectory,
			String.raw`
				import fs from 'node:fs/promises';
				import path from 'node:path';
				import prettier from 'prettier';
				import config from '@cravingmaker/prettier-config';

				const optionalPlugins = [
					'prettier-plugin-astro',
					'prettier-plugin-svelte',
					'prettier-plugin-tailwindcss',
				];

				const format = async (filename, source) => {
					const filePath = path.resolve(filename);
					await fs.mkdir(path.dirname(filePath), { recursive: true });
					await fs.writeFile(filePath, source, 'utf8');

					const resolved = await prettier.resolveConfig(filePath);
					if (!resolved) throw new Error('Shared config was not resolved');

					return prettier.format(source, Object.assign({}, resolved, { filepath: filePath }));
				};

				const javascript = await format('src/example.js', 'const greeting = "hello";');
				const typescript = await format('src/example.ts', 'const greeting: string = "hello";');
				const packageJson = await format(
					'nested/package.json',
					JSON.stringify({ version: '1.0.0', name: 'fixture' }),
				);

				const configuredPlugins = config.plugins ?? [];
				const detectedOptionalPlugins = optionalPlugins.filter((plugin) =>
					configuredPlugins.includes(plugin),
				);

				if (javascript !== "const greeting = 'hello';\n") {
					throw new Error('JavaScript formatting did not use the shared config');
				}

				if (typescript !== "const greeting: string = 'hello';\n") {
					throw new Error('TypeScript formatting did not use the shared config');
				}

				if (packageJson !== '{\n  "name": "fixture",\n  "version": "1.0.0"\n}\n') {
					throw new Error('package.json formatting did not use the package.json plugin');
				}

				if (detectedOptionalPlugins.length !== 0) {
					throw new Error('Optional plugins were detected when they were not installed');
				}

				process.stdout.write('ok');
			`,
		);

		expect(output).toBe('ok');
	});

	it('loads and uses optional Astro, Svelte, and Tailwind plugins from the consumer', async () => {
		const consumerDirectory = await createConsumer('optional-consumer', [
			...requiredDependencies,
			...optionalDependencies,
		]);

		const output = runConsumer(
			consumerDirectory,
			String.raw`
				import fs from 'node:fs/promises';
				import path from 'node:path';
				import prettier from 'prettier';
				import config from '@cravingmaker/prettier-config';

				const format = async (filename, source) => {
					const filePath = path.resolve(filename);
					await fs.writeFile(filePath, source, 'utf8');

					const resolved = await prettier.resolveConfig(filePath);
					if (!resolved) throw new Error('Shared config was not resolved');

					return prettier.format(source, Object.assign({}, resolved, { filepath: filePath }));
				};

				const astro = await format(
					'example.astro',
					'---\nconst name="World"\n---\n<div class="p-4 flex">{name}</div>',
				);
				const svelte = await format(
					'example.svelte',
					'<script>let name="World"</script><div class="p-4 flex">{name}</div>',
				);
				const html = await format('example.html', '<div class="p-4 flex">Hello</div>');

				const configuredPlugins = (config.plugins ?? []).filter((plugin) => typeof plugin === 'string');

				if (!configuredPlugins.includes('prettier-plugin-astro')) {
					throw new Error('Astro plugin was not detected');
				}

				if (!configuredPlugins.includes('prettier-plugin-svelte')) {
					throw new Error('Svelte plugin was not detected');
				}

				if (configuredPlugins.at(-1) !== 'prettier-plugin-tailwindcss') {
					throw new Error('Tailwind plugin was not loaded last');
				}

				if (!astro.includes("const name = 'World';")) {
					throw new Error('Astro parser did not format the script');
				}

				if (!astro.includes('<div class="flex p-4">{name}</div>')) {
					throw new Error('Tailwind plugin did not sort Astro classes');
				}

				if (!svelte.includes("let name = 'World';")) {
					throw new Error('Svelte parser did not format the script');
				}

				if (!svelte.includes('<div class="flex p-4">{name}</div>')) {
					throw new Error('Tailwind plugin did not sort Svelte classes');
				}

				if (html !== '<div class="flex p-4">Hello</div>\n') {
					throw new Error('Tailwind plugin did not sort HTML classes');
				}

				process.stdout.write('ok');
			`,
		);

		expect(output).toBe('ok');
	});
});
