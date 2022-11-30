import { watch, src, dest } from "gulp";

export function copyTestData() {
  return Promise.all([copyNoWorkspaceData(), copyCliIntegrationData()]);
}

export function watchTestData() {
  return watch(["src/vscode-tests/*/data/**/*"], copyTestData);
}

function copyNoWorkspaceData() {
  return src("src/vscode-tests/no-workspace/data/**/*").pipe(
    dest("out/vscode-tests/no-workspace/data"),
  );
}

function copyCliIntegrationData() {
  return src("src/vscode-tests/cli-integration/data/**/*").pipe(
    dest("out/vscode-tests/cli-integration/data"),
  );
}
