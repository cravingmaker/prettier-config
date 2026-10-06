import type { Config } from "prettier";
import config from "@cravingmaker/prettier-config";

const extended = { ...config, printWidth: 100 } satisfies Config;

// @ts-expect-error The published configuration must be typed, not any.
const invalidWidth: typeof config.printWidth = "wide";
void invalidWidth;

export default extended;
