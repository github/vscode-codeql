import { basename, extname } from "../common/path";

// From the semver package using
// const { re, t } = require("semver/internal/re");
// console.log(re[t.LOOSE]);
// Modifications:
// - Added version named group which does not capture the v prefix
// - Removed the ^ and $ anchors
// - Made the minor and patch versions optional
// - Added a hyphen to the start of the version
// - Added a dot as a valid separator between the version and the label
// - Made the patch version optional even if a label is given
// This will match any semver string at the end of a larger string
const semverRegex =
  /-[v=\s]*(?<version>([0-9]+)(\.([0-9]+)(?:(\.([0-9]+))?(?:[-.]?((?:[0-9]+|\d*[a-zA-Z-][a-zA-Z0-9-]*)(?:\.(?:[0-9]+|\d*[a-zA-Z-][a-zA-Z0-9-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?)?)?)/g;

interface Library {
  name: string;
  version?: string;
}

export function parseLibraryFilename(filename: string): Library {
  let libraryName = basename(filename);
  const extension = extname(libraryName);
  libraryName = libraryName.slice(0, -extension.length);

  let libraryVersion: string | undefined;

  let match: RegExpMatchArray | null = null;

  // Reset the regex
  semverRegex.lastIndex = 0;

  // Find the last occurence of the regex within the library name
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const currentMatch = semverRegex.exec(libraryName);
    if (currentMatch === null) {
      break;
    }

    match = currentMatch;
  }

  if (match?.groups) {
    libraryVersion = match.groups?.version;
    // Remove everything after the start of the match
    libraryName = libraryName.slice(0, match.index);
  }

  // Remove any leading or trailing hyphens or dots
  libraryName = libraryName.replaceAll(/^[.-]+|[.-]+$/g, "");

  return {
    name: libraryName,
    version: libraryVersion,
  };
}
