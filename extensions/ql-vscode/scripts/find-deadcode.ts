import { basename, join, relative, resolve } from "path";
import analyzeTsConfig from "ts-unused-exports";
import { containsPath, pathsEqual } from "../src/common/files";
import { exit } from "process";

function ignoreFile(file: string): boolean {
  return (
    containsPath("gulpfile.ts", file) ||
    containsPath(".storybook", file) ||
    containsPath(join("src", "stories"), file) ||
    pathsEqual(
      join("test", "vscode-tests", "jest-runner-vscode-codeql-cli.ts"),
      file,
    ) ||
    basename(file) === "jest.config.ts" ||
    basename(file) === "index.tsx" ||
    basename(file) === "index.ts" ||
    basename(file) === "playwright.config.ts"
  );
}

function main() {
  const repositoryRoot = resolve(join(__dirname, ".."));

  const result = analyzeTsConfig("tsconfig.deadcode.json");
  let foundUnusedExports = false;

  for (const [filepath, exportNameAndLocations] of Object.entries(result)) {
    const relativeFilepath = relative(repositoryRoot, filepath);

    if (ignoreFile(relativeFilepath)) {
      continue;
    }

    foundUnusedExports = true;

    console.log(relativeFilepath);
    for (const exportNameAndLocation of exportNameAndLocations) {
      console.log(`    ${exportNameAndLocation.exportName}`);
    }
    console.log();
  }

  if (foundUnusedExports) {
    exit(1);
  }
}

main();
