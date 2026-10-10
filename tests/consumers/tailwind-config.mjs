import config from "@cravingmaker/prettier-config";

/** @satisfies {import('prettier').Config & import('prettier-plugin-tailwindcss').PluginOptions} */
const customized = { ...config, tailwindStylesheet: "./theme.css" };

// eslint-disable-next-line import-x/no-default-export -- Installed Prettier discovers this checked fixture as prettier.config.mjs.
export default customized;
