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
} satisfies Config;
void customized;

const singleAttributePerLine: boolean = config.singleAttributePerLine;
void singleAttributePerLine;

// @ts-expect-error The published configuration must be typed, not any.
const invalidWidth: typeof config.printWidth = "wide";
void invalidWidth;

export default extended;
