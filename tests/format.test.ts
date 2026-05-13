import fs from 'node:fs/promises';
import path from 'node:path';

import prettier from 'prettier';
import { describe, expect, it } from 'vitest';

// eslint-disable-next-line import-x/extensions -- importing the TypeScript source directly is required for Vitest to resolve the module without a build step
import config from '../index.ts';

describe('Format Integration', () => {
	const fixturesDirectory = path.join(__dirname, 'fixtures');

	const testFixture = async (filename: string) => {
		const filePath = path.join(fixturesDirectory, filename);
		// eslint-disable-next-line security/detect-non-literal-fs-filename -- filePath is constructed from a trusted fixtures directory and a test-controlled filename
		const content = await fs.readFile(filePath, 'utf8');

		// Resolve options by manually applying overrides
		// eslint-disable-next-line functional/no-let -- options must be mutated across loop iterations as overrides are applied sequentially; refactoring to reduce would trigger unicorn/no-array-reduce
		let options = { ...config };
		if (config.overrides) {
			// eslint-disable-next-line functional/no-loop-statements -- sequential override application requires stateful iteration; map/reduce would not correctly accumulate merged options
			for (const override of config.overrides) {
				const patterns = Array.isArray(override.files) ? override.files : [override.files];
				const isMatch = patterns.some((pattern: string) => {
					// Handle brace expansion: {css,scss,less} -> (css|scss|less)
					const regexSource = pattern
						.replaceAll('.', String.raw`\.`)
						.replaceAll('**/*', '.*')
						.replaceAll('*', '[^/]*')
						// eslint-disable-next-line regexp/no-super-linear-move -- \{ is a literal brace, not a quantifier; no ReDoS risk
						.replaceAll(/\{(?<inner>[^}]+)\}/g, (_: string, p1: string) => `(${p1.replaceAll(',', '|')})`);

					// eslint-disable-next-line security/detect-non-literal-regexp -- regexSource is built from a trusted config pattern string, not user input
					const regex = new RegExp(`${regexSource}$`);
					return regex.test(filePath);
				});

				if (isMatch) {
					options = { ...options, ...override.options };
				}
			}
		}

		const formatted = await prettier.format(content, {
			...options,
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
