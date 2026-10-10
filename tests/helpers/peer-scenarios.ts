import packageJson from "../../package.json" with { type: "json" };

const minimumVersion = (range: string) => {
  const version = /^>=(?<version>\d+\.\d+\.\d+)(?:\s|$)/.exec(range)?.groups
    ?.version;
  if (version === undefined)
    throw new Error(`Declare an explicit minimum peer version: ${range}`);
  return version;
};
const currentPeers = {
  astro: packageJson.devDependencies["prettier-plugin-astro"],
  prettier: packageJson.devDependencies.prettier,
  svelte: packageJson.devDependencies["prettier-plugin-svelte"],
  tailwind: packageJson.devDependencies["prettier-plugin-tailwindcss"],
};
const minimumPeers = {
  astro: minimumVersion(packageJson.peerDependencies["prettier-plugin-astro"]),
  prettier: minimumVersion(packageJson.peerDependencies.prettier),
  svelte: minimumVersion(
    packageJson.peerDependencies["prettier-plugin-svelte"],
  ),
  tailwind: minimumVersion(
    packageJson.peerDependencies["prettier-plugin-tailwindcss"],
  ),
};
// eslint-disable-next-line n/no-process-env -- Select one declared compatibility scenario per suite/CI job.
const scenarioName = process.env.PRETTIER_CONFIG_PEER_SCENARIO ?? "current";
if (scenarioName !== "current" && scenarioName !== "minimum")
  throw new Error(`Unknown peer scenario: ${scenarioName}`);
const peers = scenarioName === "minimum" ? minimumPeers : currentPeers;
const peerScenario = {
  name: scenarioName,
  optionalDependencies: [
    `prettier-plugin-astro@${peers.astro}`,
    `prettier-plugin-svelte@${peers.svelte}`,
    `prettier-plugin-tailwindcss@${peers.tailwind}`,
    `svelte@${packageJson.devDependencies.svelte}`,
    "tailwindcss@4.1.14",
  ],
  prettier: peers.prettier,
};

export { peerScenario };
