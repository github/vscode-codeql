import { basename } from "path";
import { workspace } from "vscode";

/**
 * Heuristically determines if the codeql libraries are installed in this
 * workspace. Looks for the existance of a folder whose path ends in `/codeql`
 */
function hasCodeQL() {
  const folders = workspace.workspaceFolders;
  return !!folders?.some((folder) => {
    const name = basename(folder.uri.fsPath);
    return name === "codeql" || name === "ql";
  });
}

// describeWithCodeQL will be equal to describe if the CodeQL libraries are
// available in this workspace. Otherwise, it will skip the tests.
export function describeWithCodeQL() {
  if (!hasCodeQL()) {
    console.log(
      [
        "The CodeQL libraries are not available as a folder in this workspace.",
        "To fix in CI: checkout the github/codeql repository and set the 'TEST_CODEQL_PATH' environment variable to the checked out directory.",
        "To fix when running from vs code, see the comment in the launch.json file in the 'Launch Integration Tests - With CLI' section.",
      ].join("\n\n"),
    );
    return describe.skip;
  }

  return describe;
}

// itWithCodeQL will be equal to it if the CodeQL libraries are
// available in this workspace. Otherwise, it will skip the tests.
export function itWithCodeQL() {
  if (!hasCodeQL()) {
    console.log(
      [
        "The CodeQL libraries are not available as a folder in this workspace.",
        "To fix in CI: checkout the github/codeql repository and set the 'TEST_CODEQL_PATH' environment variable to the checked out directory.",
        "To fix when running from vs code, see the comment in the launch.json file in the 'Launch Integration Tests - With CLI' section.",
      ].join("\n\n"),
    );
    return it.skip;
  }

  return it;
}
