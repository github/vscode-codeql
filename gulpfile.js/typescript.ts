import * as gulp from 'gulp';
import * as sourcemaps from 'gulp-sourcemaps';
import * as ts from 'gulp-typescript';

const tsProject = ts.createProject('tsconfig.json');

export async function compileTypeScript() {
  return tsProject.src()
    .pipe(sourcemaps.init())
    .pipe(tsProject())
    .pipe(sourcemaps.write('.', { includeContent: false, sourceRoot: '' }))
    .pipe(gulp.dest('out'));
}

export async function watchTypeScript() {
  gulp.watch('src/**/*.ts', compileTypeScript);
}
