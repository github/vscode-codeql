import * as colors from 'ansi-colors';
import * as gulp from 'gulp';
import esbuild from 'gulp-esbuild';
import ts from 'gulp-typescript';
import del from 'del';

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
const testsTsProject = ts.createProject('tsconfig.json', {
  esModuleInterop: false,
});

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

export function compileTypeScriptTests() {
  // Unfortunately we cannot use ESBuild for the test compilation because it compiles
  // to ES6 modules which have additional restrictions compared to the code generated
  // by the TypeScript compiler.
  return testsTsProject.src()
    .pipe(testsTsProject(goodReporter()))
    .pipe(gulp.dest('out/test-run'));
}

export function watchEsbuild() {
  gulp.watch('src/**/*.ts', compileEsbuild);
}

export function watchTypeScriptTests() {
  gulp.watch('src/**/*.ts', compileTypeScriptTests);
}

export function checkTypeScript() {
  // This doesn't actually output the TypeScript files, it just
  // runs the TypeScript compiler and reports any errors.
  return tsProject.src();
  // .pipe(tsProject(goodReporter()));
}

export function watchCheckTypeScript() {
  gulp.watch('src/**/*.ts', checkTypeScript);
}
