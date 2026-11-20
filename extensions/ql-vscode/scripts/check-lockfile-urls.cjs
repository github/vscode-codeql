const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const paths = process.argv.slice(2);
if (paths.length === 0) {
  paths.push(resolve(__dirname, "../package-lock.json"));
}

for (const path of paths) {
  const lockfile = JSON.parse(readFileSync(path, "utf8"));
  if (
    !lockfile.packages ||
    typeof lockfile.packages !== "object" ||
    Array.isArray(lockfile.packages)
  ) {
    throw new Error(`${path}: expected a lockfile with a packages object`);
  }

  for (const [name, entry] of Object.entries(lockfile.packages)) {
    if (!Object.hasOwn(entry, "resolved")) {
      continue;
    }

    let url;
    try {
      if (typeof entry.resolved !== "string") {
        throw new TypeError("Expected a URL string");
      }
      url = new URL(entry.resolved);
    } catch (error) {
      if (!(error instanceof TypeError)) {
        throw error;
      }
      console.error(`${path}: ${name}: invalid resolved URL`);
      process.exitCode = 1;
      continue;
    }

    if (
      url.protocol !== "https:" ||
      url.host !== "registry.npmjs.org" ||
      url.username ||
      url.password
    ) {
      console.error(
        `${path}: ${name}: resolved URL must use https://registry.npmjs.org without credentials (received ${url.protocol}//${url.host})`,
      );
      process.exitCode = 1;
    }
  }
}
