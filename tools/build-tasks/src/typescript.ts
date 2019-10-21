import * as colors from 'ansi-colors';
import * as gulp from 'gulp';
import * as path from 'path';
import * as sourcemaps from 'gulp-sourcemaps';
import * as ts from 'gulp-typescript';
import { RushConfiguration } from '@microsoft/rush-lib';

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
  // Find this project's relative directory. Rush already knows this, so just ask.
  const packageDir = path.resolve('.');
  const rushConfig = RushConfiguration.loadFromDefaultLocation({
    startingFolder: packageDir
  });
  const project = rushConfig.tryGetProjectForPath(packageDir);
  if (!project) {
    console.error(`Unable to find project for '${packageDir}' in 'rush.json'.`);
    throw Error();
  }

  //REVIEW: Better way to detect deployable projects?
  // Since extension .js files are deployed to 'dist/<package>/out', and libraries are deployed to
  // 'dist/<app package>/node_modules/<package>/out'.
  const pathToRoot = (path.dirname(project.projectRelativeFolder) === 'extensions') ?
    '../../..' : '../../../../..';

  return tsProject.src()
    .pipe(sourcemaps.init())
    .pipe(tsProject(goodReporter()))
    .pipe(sourcemaps.mapSources((sourcePath, file) => {
      // The source path is kind of odd, because it's relative to the `tsconfig.json` file in the
      // `typescript-config` package, which lives in the `node_modules` directory of the package
      // that is being built. It starts out as something like '../../../src/foo.ts', and we need to
      // strip out the leading '../../../'.
      return path.join('a/b/c', sourcePath);
    }))
    .pipe(sourcemaps.write('.', {
      includeContent: false,
      sourceRoot: path.join(pathToRoot, project.projectRelativeFolder)
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
