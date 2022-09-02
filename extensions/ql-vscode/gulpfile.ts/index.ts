import * as gulp from 'gulp';
import { compileEsbuild, watchEsbuild, cleanOutput, checkTypeScript, watchCheckTypeScript, compileTypeScriptTests, watchTypeScriptTests } from './typescript';
import { compileTextMateGrammar } from './textmate';
import { copyTestData, copyTests, watchCopyTests } from './tests';
import { compileView, watchView } from './webpack';
import { packageExtension } from './package';
import { injectAppInsightsKey } from './appInsights';

export const buildWithoutPackage =
  gulp.series(
    cleanOutput,
    gulp.parallel(compileEsbuild, compileTextMateGrammar, compileView, copyTestData, checkTypeScript, compileTypeScriptTests)
  );

export const watch = gulp.parallel(
  watchEsbuild, watchTypeScriptTests, watchCheckTypeScript, watchView, watchCopyTests
);

export const buildTests = gulp.series(
  buildWithoutPackage,
  copyTests
);

export {
  cleanOutput,
  compileTextMateGrammar,
  watchEsbuild,
  watchView,
  compileEsbuild,
  copyTestData,
  injectAppInsightsKey,
  compileView,
  checkTypeScript,
  watchCheckTypeScript,
  compileTypeScriptTests,
  watchTypeScriptTests,
};
export default gulp.series(buildWithoutPackage, injectAppInsightsKey, packageExtension, copyTests);
