import type { Config } from "prettier";
import config from "@cravingmaker/prettier-config";

const extended = { ...config, printWidth: 100 } satisfies Config;

// The keys the shared config always sets must spread without a fallback.
const customized = {
  ...config,
  overrides: [
    ...config.overrides,
    { files: ["*.md"], options: { proseWrap: "always" } },
  ],
  plugins: [...config.plugins],
  tailwindFunctions: [...config.tailwindFunctions, "tw"],
} satisfies typeof config;
void customized;

const singleAttributePerLine: boolean = config.singleAttributePerLine;
void singleAttributePerLine;

const printWidth: number = config.printWidth;
void printWidth;

// @ts-expect-error The published configuration must be typed, not any.
const invalidWidth: typeof config.printWidth = "wide";
void invalidWidth;

// @ts-expect-error Tailwind function names must be strings.
const invalidTailwindFunctions: typeof config.tailwindFunctions = [false];
void invalidTailwindFunctions;

export default extended;
