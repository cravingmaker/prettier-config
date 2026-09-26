import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import prettier from 'prettier';
import { afterAll, describe, expect, it } from 'vitest';

const fixturesDirectory = path.join(__dirname, 'fixtures');
const distributionConfig = path.resolve(__dirname, '..', 'dist', 'index.js');
const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'prettier-config-format-'));
const configPath = path.join(temporaryDirectory, 'prettier.config.mjs');

await fs.writeFile(
	configPath,
	`export { default } from ${JSON.stringify(pathToFileURL(distributionConfig).href)};\n`,
	'utf8',
);

describe('Format Integration', () => {
	afterAll(async () => {
		await fs.rm(temporaryDirectory, {
			force: true,
			recursive: true,
		});
	});

	const testFixture = async (filename: string) => {
		const sourcePath = path.join(fixturesDirectory, filename);
		const filePath = path.join(temporaryDirectory, filename);
		const content = await fs.readFile(sourcePath, 'utf8');

		await fs.writeFile(filePath, content, 'utf8');

		const resolvedConfig = await prettier.resolveConfig(filePath, {
			config: configPath,
			editorconfig: false,
		});

		expect(resolvedConfig).not.toBeNull();

		const formatted = await prettier.format(content, {
			...(resolvedConfig ?? {}),
			filepath: filePath,
		});

		expect(formatted).toMatchSnapshot();
	};

	it('01. formats TypeScript correctly', async () => {
		await testFixture('sample.ts');
	});

	it('02. formats JavaScript correctly', async () => {
		await testFixture('sample.js');
	});

	it('03. formats TSX correctly', async () => {
		await testFixture('sample.tsx');
	});

	it('04. formats JSX correctly', async () => {
		await testFixture('sample.jsx');
	});

	it('05. formats Astro correctly', async () => {
		await testFixture('sample.astro');
	});

	it('06. formats Svelte correctly', async () => {
		await testFixture('sample.svelte');
	});

	it('07. formats HTML correctly', async () => {
		await testFixture('sample.html');
	});

	it('08. formats CSS correctly', async () => {
		await testFixture('sample.css');
	});

	it('09. formats Markdown correctly', async () => {
		await testFixture('sample.md');
	});

	it('10. formats package.json correctly', async () => {
		await testFixture('package.json');
	});
});
