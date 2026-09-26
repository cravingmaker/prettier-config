import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const requiredDependencies = ['prettier', 'prettier-plugin-packagejson', '@prettier/plugin-oxc'];

const optionalDependencies = [
	'prettier-plugin-astro',
	'prettier-plugin-svelte',
	'prettier-plugin-tailwindcss',
	'svelte',
];

describe('Published Package', () => {
	const projectDirectory = path.resolve(__dirname, '..');

	let temporaryDirectory: string;
	let tarball: string;

	beforeAll(async () => {
		temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'prettier-config-package-'));

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

		tarball = path.join(temporaryDirectory, tarballFilename);
	});

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

	const createConsumer = async (name: string, dependencies: string[]) => {
		const consumerDirectory = path.join(temporaryDirectory, name);
		const nodeModulesDirectory = path.join(consumerDirectory, 'node_modules');
		const packageDirectory = path.join(nodeModulesDirectory, '@cravingmaker', 'prettier-config');

		await fs.mkdir(packageDirectory, {
			recursive: true,
		});

		execFileSync('tar', ['-xzf', tarball, '--strip-components=1', '-C', packageDirectory], {
			cwd: temporaryDirectory,
		});

		await Promise.all(dependencies.map((dependency) => linkDependency(nodeModulesDirectory, dependency)));

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

	const runConsumer = (consumerDirectory: string, script: string) =>
		execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
			cwd: consumerDirectory,
			encoding: 'utf8',
		});

	it('works from the packed tarball without optional plugins', async () => {
		const consumerDirectory = await createConsumer('base-consumer', requiredDependencies);

		const output = runConsumer(
			consumerDirectory,
			`
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

					return prettier.format(source, { ...resolved, filepath: filePath });
				};

				const javascript = await format('src/example.js', 'const greeting = "hello";');
				const typescript = await format('src/example.ts', 'const greeting: string = "hello";');
				const packageJson = await format(
					'nested/package.json',
					JSON.stringify({ version: '1.0.0', name: 'fixture' }),
				);

				const configuredPlugins = config.plugins ?? [];

				process.stdout.write(
					JSON.stringify({
						javascript,
						optionalPlugins: optionalPlugins.filter((plugin) => configuredPlugins.includes(plugin)),
						packageJson,
						typescript,
					}),
				);
			`,
		);

		const result = JSON.parse(output) as {
			javascript: string;
			optionalPlugins: string[];
			packageJson: string;
			typescript: string;
		};

		expect(result).toEqual({
			javascript: "const greeting = 'hello';\n",
			optionalPlugins: [],
			packageJson: '{\n  "name": "fixture",\n  "version": "1.0.0"\n}\n',
			typescript: "const greeting: string = 'hello';\n",
		});
	});

	it('loads and uses optional Astro, Svelte, and Tailwind plugins from the consumer', async () => {
		const consumerDirectory = await createConsumer('optional-consumer', [
			...requiredDependencies,
			...optionalDependencies,
		]);

		const output = runConsumer(
			consumerDirectory,
			`
				import fs from 'node:fs/promises';
				import path from 'node:path';
				import prettier from 'prettier';
				import config from '@cravingmaker/prettier-config';

				const format = async (filename, source) => {
					const filePath = path.resolve(filename);
					await fs.writeFile(filePath, source, 'utf8');

					const resolved = await prettier.resolveConfig(filePath);
					if (!resolved) throw new Error('Shared config was not resolved');

					return prettier.format(source, { ...resolved, filepath: filePath });
				};

				const astro = await format(
					'example.astro',
					'---\\nconst name="World"\\n---\\n<div class="p-4 flex">{name}</div>',
				);
				const svelte = await format(
					'example.svelte',
					'<script>let name="World"</script><div class="p-4 flex">{name}</div>',
				);
				const html = await format('example.html', '<div class="p-4 flex">Hello</div>');

				const configuredPlugins = config.plugins ?? [];

				process.stdout.write(
					JSON.stringify({
						astro,
						html,
						plugins: configuredPlugins.filter((plugin) => typeof plugin === 'string'),
						svelte,
					}),
				);
			`,
		);

		const result = JSON.parse(output) as {
			astro: string;
			html: string;
			plugins: string[];
			svelte: string;
		};

		expect(result.plugins).toContain('prettier-plugin-astro');
		expect(result.plugins).toContain('prettier-plugin-svelte');
		expect(result.plugins.at(-1)).toBe('prettier-plugin-tailwindcss');

		expect(result.astro).toContain("const name = 'World';");
		expect(result.astro).toContain('<div class="flex p-4">{name}</div>');
		expect(result.svelte).toContain("let name = 'World';");
		expect(result.svelte).toContain('<div class="flex p-4">{name}</div>');
		expect(result.html).toBe('<div class="flex p-4">Hello</div>\n');
	});
});
