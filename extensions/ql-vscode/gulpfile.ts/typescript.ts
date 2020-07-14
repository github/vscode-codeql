import * as colors from 'ansi-colors';
import * as gulp from 'gulp';
import * as path from 'path';
import * as sourcemaps from 'gulp-sourcemaps';
import * as ts from 'gulp-typescript';

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

export function compileTypeScript() {
  return tsProject.src()
    .pipe(sourcemaps.init())
    .pipe(tsProject(goodReporter()))
    .pipe((sourcemaps as any).mapSources((sourcePath: string, _file: string) => {
      // The source path is kind of odd, because it's relative to the `tsconfig.json` file in the
      // `typescript-config` package, which lives in the `node_modules` directory of the package
      // that is being built. It starts out as something like '../../../src/foo.ts', and we need to
      // strip out the leading '../../../'.
      return path.join('a/b/c', sourcePath);
    }))
    .pipe(sourcemaps.write('.', {
      includeContent: false,
      sourceRoot: '.', // XXX this is probably wrong
    }))
    .pipe(gulp.dest('out'));
}

export function watchTypeScript() {
  gulp.watch('src/**/*.ts', compileTypeScript);
}

/** Copy CSS files for the results view into the output directory. */
export function copyViewCss() {
  return gulp.src('src/view/*.css')
    .pipe(gulp.dest('out'));
}
