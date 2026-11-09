import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function releaseChannel(version, refType, refName) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Marketplace requires a numeric manifest version: ${version}`);
  }
  if (refType !== "tag") return "build";
  if (refName === `v${version}`) return "release";
  const match = /^v(\d+\.\d+\.\d+)-pre\.([1-9]\d*)$/.exec(refName);
  if (match?.[1] === version) return "pre-release";
  throw new Error(`Tag ${refName} does not match v${version} or v${version}-pre.N`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const { version } = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  const channel = releaseChannel(version, process.env.GITHUB_REF_TYPE, process.env.GITHUB_REF_NAME);
  const output = `channel=${channel}\npre_release=${channel === "pre-release"}\n`;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, output);
  process.stdout.write(output);
}
