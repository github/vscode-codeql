import * as colors from 'ansi-colors';
import * as gulp from 'gulp';
import esbuild from 'gulp-esbuild';
import ts from 'gulp-typescript';
import del from 'del';

import packageJSON from '../package.json';

function goodReporter(): ts.reporter.Reporter {
  return {
    error: (error, typescript) => {
      if (error.tsFile) {
        console.log('[' + colors.gray('gulp-typescript') + '] ' + colors.red(error.fullFilename
          + '(' + (error.startPosition!.line + 1) + ',' + error.startPosition!.character + '): ')
          + 'error TS' + error.diagnostic.code + ': ' + typescript.flattenDiagnosticMessageText(error.diagnostic.messageText, '\n'));
      }
      else {
        console.log(error.message);
      }
    },
  };
}

const tsProject = ts.createProject('tsconfig.json');

export function cleanOutput() {
  return tsProject.projectDirectory ? del(tsProject.projectDirectory + '/out/*') : Promise.resolve();
}

export function compileEsbuild() {
  return gulp.src('./src/extension.ts')
    .pipe(esbuild({
      outfile: 'extension.js',
      bundle: true,
      external: ['vscode'],
      format: 'cjs',
      platform: 'node',
      target: 'es2020',
      sourcemap: 'linked',
    }))
    .pipe(gulp.dest('out'));
}

export function compileEsbuildTests() {
  const external = ['vscode', ...Object.keys(packageJSON.dependencies), ...Object.keys(packageJSON.devDependencies)];

  return gulp.src('./src/vscode-tests/**/*.ts')
    .pipe(esbuild({
      outdir: 'vscode-tests',
      bundle: true,
      external,
      format: 'cjs',
      platform: 'node',
      target: 'es2020',
      sourcemap: 'linked',
    }))
    .pipe(gulp.dest('out'));
}

export function watchEsbuild() {
  gulp.watch('src/**/*.ts', compileEsbuild);
}

export function watchEsbuildTests() {
  gulp.watch('src/**/*.ts', compileEsbuildTests);
}

export function checkTypeScript() {
  // This doesn't actually output the TypeScript files, it just
  // runs the TypeScript compiler and reports any errors.
  return tsProject.src()
    .pipe(tsProject(goodReporter()));
}

export function watchCheckTypeScript() {
  gulp.watch('src/**/*.ts', checkTypeScript);
}
