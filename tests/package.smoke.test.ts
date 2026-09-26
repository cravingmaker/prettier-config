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

const runConsumer = (consumerDirectory: string, script: string, externalCwd: boolean) =>
	execFileSync(
		process.execPath,
		[
			'--input-type=module',
			'--eval',
			`const consumerDirectory = process.cwd();\n${externalCwd ? `process.chdir(${JSON.stringify(path.dirname(consumerDirectory))});` : ''}\n${script}`,
		],
		{
			cwd: consumerDirectory,
			encoding: 'utf8',
		},
	);

const linkDependency = async (nodeModulesDirectory: string, dependency: string) => {
	const source = path.join(projectDirectory, 'node_modules', dependency);
	const destination = path.join(nodeModulesDirectory, dependency);

	await fs.mkdir(path.dirname(destination), {
		recursive: true,
	});

	await fs.symlink(source, destination, 'junction');
};

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

describe('Published Package', () => {
	afterAll(async () => {
		await fs.rm(temporaryDirectory, {
			force: true,
			recursive: true,
		});
	});

	it('ships the runtime and public types without build artifacts', () => {
		const entries = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' }).trim().split('\n');

		expect(entries).toHaveLength(4);
		expect(entries).toEqual(
			expect.arrayContaining(['package/README.md', 'package/index.d.ts', 'package/index.mjs', 'package/package.json']),
		);
	});

	it.each([false, true])('works without optional plugins (external cwd: %s)', async (externalCwd) => {
		const consumerDirectory = await createConsumer(`base-consumer-${String(externalCwd)}`, requiredDependencies);

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
					const filePath = path.resolve(consumerDirectory, filename);
					await fs.mkdir(path.dirname(filePath), { recursive: true });
					await fs.writeFile(filePath, source, 'utf8');

					const resolved = await prettier.resolveConfig(filePath);
					if (!resolved) throw new Error('Shared config was not resolved');

					const options = Object.assign({}, resolved, { filepath: filePath });
					const formatted = await prettier.format(source, options);
					if (await prettier.format(formatted, options) !== formatted) {
						throw new Error('Formatting is not idempotent for ' + filename);
					}

					return formatted;
				};

				const javascript = await format('src/example.js', 'const greeting = "hello";');
				const typescript = await format('src/example.ts', 'const greeting: string = "hello";');
				const packageJson = await format(
					'nested/package.json',
					JSON.stringify({ version: '1.0.0', name: 'fixture' }),
				);

				const configuredPlugins = config.plugins ?? [];
				const detectedOptionalPlugins = optionalPlugins.filter((plugin) =>
					configuredPlugins.some((entry) => typeof entry === 'string' && entry.includes(plugin)),
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
			externalCwd,
		);

		expect(output).toBe('ok');
	});

	it.each([false, true])('loads optional plugins from the consumer (external cwd: %s)', async (externalCwd) => {
		const consumerDirectory = await createConsumer(`optional-consumer-${String(externalCwd)}`, [
			...requiredDependencies,
			...optionalDependencies,
		]);

		const output = runConsumer(
			consumerDirectory,
			String.raw`
				import fs from 'node:fs/promises';
				import path from 'node:path';
				import { createRequire } from 'node:module';
				import prettier from 'prettier';
				import config from '@cravingmaker/prettier-config';

				const format = async (filename, source) => {
					const filePath = path.resolve(consumerDirectory, filename);
					await fs.writeFile(filePath, source, 'utf8');

					const resolved = await prettier.resolveConfig(filePath);
					if (!resolved) throw new Error('Shared config was not resolved');

					const options = Object.assign({}, resolved, { filepath: filePath });
					const formatted = await prettier.format(source, options);
					if (await prettier.format(formatted, options) !== formatted) {
						throw new Error('Formatting is not idempotent for ' + filename);
					}

					return formatted;
				};

				const astro = await format(
					'example.astro',
					'---\nconst name="World"\n---\n<div class="p-4 flex">{name}</div>',
				);
				const svelte = await format(
					'example.svelte',
					'<script>let name="World"</script><div class="p-4 flex">{name}</div>',
				);
				const require = createRequire(path.join(consumerDirectory, 'package.json'));
				const configuredPlugins = (config.plugins ?? []).filter((plugin) => typeof plugin === 'string');

				if (!configuredPlugins.includes(require.resolve('prettier-plugin-astro'))) {
					throw new Error('Astro plugin was not detected');
				}

				if (!configuredPlugins.includes(require.resolve('prettier-plugin-svelte'))) {
					throw new Error('Svelte plugin was not detected');
				}

				if (configuredPlugins.at(-1) !== require.resolve('prettier-plugin-tailwindcss')) {
					throw new Error('Tailwind plugin was not loaded last');
				}

				if (!astro.includes("const name = 'World';")) {
					throw new Error('Astro parser did not format the script');
				}

				if (!svelte.includes("let name = 'World';")) {
					throw new Error('Svelte parser did not format the script');
				}

				if (!/class=['"]flex p-4['"]/.test(svelte)) {
					throw new Error('Tailwind did not sort Svelte classes: ' + svelte);
				}

				if (!/class=['"]flex p-4['"]/.test(astro)) {
					throw new Error('Tailwind did not sort Astro classes: ' + astro);
				}

				process.stdout.write('ok');
			`,
			externalCwd,
		);

		expect(output).toBe('ok');
	});
});
