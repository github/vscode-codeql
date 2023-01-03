import { watch, src, dest } from "gulp";

export function copyTestData() {
  return Promise.all([copyNoWorkspaceData(), copyCliIntegrationData()]);
}

export function watchTestData() {
  return watch(["test/vscode-tests/*/data/**/*"], copyTestData);
}

function copyNoWorkspaceData() {
  return src("test/vscode-tests/no-workspace/data/**/*").pipe(
    dest("out/vscode-tests/no-workspace/data"),
  );
}

function copyCliIntegrationData() {
  return src("test/vscode-tests/cli-integration/data/**/*").pipe(
    dest("out/vscode-tests/cli-integration/data"),
  );
}
