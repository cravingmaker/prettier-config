import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('Published Package', () => {
	it('should work when consumed from the packed tarball', async () => {
		const projectDirectory = path.resolve(__dirname, '..');
		const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'prettier-config-'));

		try {
			const consumerDirectory = path.join(temporaryDirectory, 'consumer');

			const nodeModulesDirectory = path.join(consumerDirectory, 'node_modules');

			await fs.mkdir(nodeModulesDirectory, {
				recursive: true,
			});

			const packOutput = execFileSync(
				'npm',
				['pack', '--json', '--ignore-scripts', '--pack-destination', temporaryDirectory],
				{
					cwd: projectDirectory,
					encoding: 'utf8',
				},
			);

			const packResult: unknown = JSON.parse(packOutput);

			if (!Array.isArray(packResult) || packResult.length === 0) {
				throw new Error('npm pack returned no package');
			}

			const firstResult: unknown = packResult[0];

			if (
				typeof firstResult !== 'object' ||
				firstResult === null ||
				!('filename' in firstResult) ||
				typeof firstResult.filename !== 'string'
			) {
				throw new Error('npm pack returned an invalid result');
			}

			const tarball = path.join(temporaryDirectory, firstResult.filename);

			const packageDirectory = path.join(nodeModulesDirectory, '@cravingmaker', 'prettier-config');

			await fs.mkdir(packageDirectory, {
				recursive: true,
			});

			execFileSync('tar', ['-xzf', tarball, '--strip-components=1', '-C', packageDirectory], {
				cwd: temporaryDirectory,
			});

			const dependencies = ['prettier', 'prettier-plugin-packagejson', '@prettier/plugin-oxc'];

			await Promise.all(
				dependencies.map(async (dependency) => {
					const source = path.join(projectDirectory, 'node_modules', dependency);

					const destination = path.join(nodeModulesDirectory, dependency);

					await fs.mkdir(path.dirname(destination), {
						recursive: true,
					});

					await fs.symlink(source, destination, 'junction');
				}),
			);

			await fs.writeFile(
				path.join(consumerDirectory, 'package.json'),
				JSON.stringify({
					name: 'prettier-config-consumer',
					private: true,
					type: 'module',
				}),
			);

			const consumerScript = `
				import prettier from 'prettier';
				import config from '@cravingmaker/prettier-config';

				if (!config || typeof config !== 'object') {
					throw new Error('Invalid Prettier config export');
				}

				const javascript = await prettier.format(
					'const greeting = "hello";',
					Object.assign({}, config, {
						filepath: 'example.js',
					}),
				);

				const typescript = await prettier.format(
					'const greeting: string = "hello";',
					Object.assign({}, config, {
						filepath: 'example.ts',
					}),
				);

				process.stdout.write(
					JSON.stringify({
						javascript,
						typescript,
					}),
				);
			`;

			const output = execFileSync(process.execPath, ['--input-type=module', '--eval', consumerScript], {
				cwd: consumerDirectory,
				encoding: 'utf8',
			});

			expect(output).toBe(
				JSON.stringify({
					javascript: "const greeting = 'hello';\n",
					typescript: "const greeting: string = 'hello';\n",
				}),
			);
		} finally {
			await fs.rm(temporaryDirectory, {
				force: true,
				recursive: true,
			});
		}
	});
});
