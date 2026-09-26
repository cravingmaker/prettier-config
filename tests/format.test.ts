import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import prettier from 'prettier';
import { afterAll, describe, expect, it } from 'vitest';

const fixturesDirectory = path.join(__dirname, 'fixtures');
const runtimeConfig = path.resolve(__dirname, '..', 'index.mjs');
const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'prettier-config-format-'));
const configPath = path.join(temporaryDirectory, 'prettier.config.mjs');

const prepareFixture = async (filename: string, directory: string) => {
	const sourcePath = path.join(fixturesDirectory, filename);
	const filePath = path.join(directory, filename);
	const content = await fs.readFile(sourcePath, 'utf8');

	await fs.writeFile(filePath, content, 'utf8');

	return filePath;
};

const testFixture = async (filename: string, directory: string, prettierConfigPath: string) => {
	const filePath = await prepareFixture(filename, directory);
	const content = await fs.readFile(filePath, 'utf8');

	const resolvedConfig = await prettier.resolveConfig(filePath, {
		config: prettierConfigPath,
		editorconfig: false,
	});

	expect(resolvedConfig).not.toBeNull();

	const formatted = await prettier.format(content, {
		...resolvedConfig,
		filepath: filePath,
	});

	expect(formatted).toMatchSnapshot();
};

const expectResolvedOptions = async (
	filename: string,
	directory: string,
	prettierConfigPath: string,
	expectedOptions: Readonly<Record<string, unknown>>,
) => {
	const filePath = await prepareFixture(filename, directory);

	const resolvedConfig = await prettier.resolveConfig(filePath, {
		config: prettierConfigPath,
		editorconfig: false,
	});

	expect(resolvedConfig).toMatchObject(expectedOptions);
};

await fs.writeFile(
	configPath,
	`export { default } from ${JSON.stringify(pathToFileURL(runtimeConfig).href)};\n`,
	'utf8',
);

describe('Format Integration', () => {
	afterAll(async () => {
		await fs.rm(temporaryDirectory, {
			force: true,
			recursive: true,
		});
	});

	it('01. formats TypeScript correctly', async () => {
		await testFixture('sample.ts', temporaryDirectory, configPath);
	});

	it('02. formats JavaScript correctly', async () => {
		await testFixture('sample.js', temporaryDirectory, configPath);
	});

	it('03. formats TSX correctly', async () => {
		await testFixture('sample.tsx', temporaryDirectory, configPath);
	});

	it('04. formats JSX correctly', async () => {
		await testFixture('sample.jsx', temporaryDirectory, configPath);
	});

	it('05. formats Astro correctly', async () => {
		await testFixture('sample.astro', temporaryDirectory, configPath);
	});

	it('06. formats Svelte correctly', async () => {
		await testFixture('sample.svelte', temporaryDirectory, configPath);
	});

	it('07. formats HTML correctly', async () => {
		await testFixture('sample.html', temporaryDirectory, configPath);
	});

	it('08. formats CSS correctly', async () => {
		await testFixture('sample.css', temporaryDirectory, configPath);
	});

	it('09. formats Markdown correctly', async () => {
		await testFixture('sample.md', temporaryDirectory, configPath);
	});

	it('10. formats package.json correctly', async () => {
		await testFixture('package.json', temporaryDirectory, configPath);
	});

	it('11. applies space-based JSON options to JSON', async () => {
		await expectResolvedOptions('sample.json', temporaryDirectory, configPath, {
			singleQuote: false,
			trailingComma: 'none',
			useTabs: false,
		});
	});

	it('12. applies space-based JSON options to JSONC', async () => {
		await expectResolvedOptions('sample.jsonc', temporaryDirectory, configPath, {
			singleQuote: false,
			trailingComma: 'none',
			useTabs: false,
		});
	});

	it('13. applies space-based JSON options to JSON5', async () => {
		await expectResolvedOptions('sample.json5', temporaryDirectory, configPath, {
			singleQuote: false,
			trailingComma: 'none',
			useTabs: false,
		});
	});

	it('14. applies space-based YAML options to YAML', async () => {
		await expectResolvedOptions('sample.yaml', temporaryDirectory, configPath, {
			useTabs: false,
		});
	});

	it('15. applies space-based YAML options to YML', async () => {
		await expectResolvedOptions('sample.yml', temporaryDirectory, configPath, {
			useTabs: false,
		});
	});

	it('16. applies Markdown options to MDX', async () => {
		await expectResolvedOptions('sample.mdx', temporaryDirectory, configPath, {
			printWidth: 80,
			singleQuote: false,
			trailingComma: 'none',
			useTabs: false,
		});
	});

	it('17. formats TOML correctly', async () => {
		await testFixture('sample.toml', temporaryDirectory, configPath);
	});

	it('18. applies TOML options', async () => {
		await expectResolvedOptions('sample.toml', temporaryDirectory, configPath, {
			parser: 'toml',
			printWidth: 100,
			tabWidth: 2,
			useTabs: false,
		});
	});
});
