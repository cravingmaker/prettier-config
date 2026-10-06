import type { Config } from "prettier";

// The shared config always sets these keys, so consumers can spread them without a fallback.
declare const config: Config &
  Required<Pick<Config, "overrides" | "plugins" | "singleAttributePerLine">>;

// eslint-disable-next-line import-x/no-default-export -- Prettier configuration requires a default export
export default config;
