import * as gulp from "gulp";

export function copyTestData() {
  return Promise.all([copyNoWorkspaceData(), copyCliIntegrationData()]);
}

export function watchTestData() {
  return gulp.watch(["src/vscode-tests/*/data/**/*"], copyTestData);
}

function copyNoWorkspaceData() {
  return gulp
    .src("src/vscode-tests/no-workspace/data/**/*")
    .pipe(gulp.dest("out/vscode-tests/no-workspace/data"));
}

function copyCliIntegrationData() {
  return gulp
    .src("src/vscode-tests/cli-integration/data/**/*")
    .pipe(gulp.dest("out/vscode-tests/cli-integration/data"));
}
