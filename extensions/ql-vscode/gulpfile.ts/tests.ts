import * as gulp from 'gulp';
import * as path from 'path';
import del from 'del';
import { copyTestPackageToDist } from './deploy';

const testDistDir = path.join(__dirname, '../../../dist-test');

export function copyTestData() {
  copyNoWorkspaceData();
  copyCliIntegrationData();
  return Promise.resolve();
}

function copyNoWorkspaceData() {
  return gulp.src('src/vscode-tests/no-workspace/data/**/*')
    .pipe(gulp.dest('out/test-run/vscode-tests/no-workspace/data'));
}

function copyCliIntegrationData() {
  return gulp.src('src/vscode-tests/cli-integration/data*/**/*')
    .pipe(gulp.dest('out/test-run/vscode-tests/cli-integration'));
}

function cleanTestsOutput() {
  // The path to the test dist dir is outside of the working directory, so we need to force it
  return del(testDistDir, { force: true });
}

async function copyToTests(): Promise<void> {
  await copyTestPackageToDist(testDistDir, path.resolve('package.json'));
}

async function copyTestsWithoutNodeModules(): Promise<void> {
  await copyTestPackageToDist(testDistDir, path.resolve('package.json'), false);
}

export const copyTests = gulp.series(cleanTestsOutput, copyToTests);

export function watchCopyTests() {
  gulp.watch('out/**/*', copyTestsWithoutNodeModules);
}
