import fs from 'node:fs/promises';
import path from 'node:path';
import prettier from 'prettier';
import { describe, expect, it } from 'vitest';

import config from '../index.ts';

describe('Format Integration', () => {
	const fixturesDir = path.join(__dirname, 'fixtures');

	const testFixture = async (filename: string) => {
		const filePath = path.join(fixturesDir, filename);
		const content = await fs.readFile(filePath, 'utf-8');

		// Resolve options by manually applying overrides
		let options = { ...config };
		if (config.overrides) {
			for (const override of config.overrides) {
				const patterns = Array.isArray(override.files) ? override.files : [override.files];
				const isMatch = patterns.some((pattern: string) => {
					// Handle brace expansion: {css,scss,less} -> (css|scss|less)
					const regexSource = pattern
						.replace(/\./g, '\\.')
						.replace(/\*\*\/\*/g, '.*')
						.replace(/\*/g, '[^/]*')
						.replace(/\{([^}]+)\}/g, (_: string, p1: string) => `(${p1.replace(/,/g, '|')})`);

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
