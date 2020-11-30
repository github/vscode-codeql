import * as gulp from 'gulp';

export function copyTestData() {
  copyNoWorkspaceData();
  copyCliIntegrationData();
  return Promise.resolve();
}

function copyNoWorkspaceData() {
  return gulp.src('src/vscode-tests/no-workspace/data/**/*')
    .pipe(gulp.dest('out/vscode-tests/no-workspace/data'));
}

function copyCliIntegrationData() {
  return gulp.src('src/vscode-tests/cli-integration/data/**/*')
    .pipe(gulp.dest('out/vscode-tests/cli-integration/data'));
}
