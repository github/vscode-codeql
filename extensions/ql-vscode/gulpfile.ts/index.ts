import * as gulp from 'gulp';
import { compileEsbuild, watchEsbuild, copyViewCss, cleanOutput, watchCss, checkTypeScript, watchCheckTypeScript, compileEsbuildTests, watchEsbuildTests } from './typescript';
import { compileTextMateGrammar } from './textmate';
import { copyTestData } from './tests';
import { compileView, watchView } from './webpack';
import { packageExtension } from './package';
import { injectAppInsightsKey } from './appInsights';

export const buildWithoutPackage =
  gulp.series(
    cleanOutput,
    gulp.parallel(
      compileEsbuild, compileTextMateGrammar, compileView, copyTestData, copyViewCss, checkTypeScript, compileEsbuildTests
    )
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
  watchCss,
  checkTypeScript,
  watchCheckTypeScript,
  compileEsbuildTests,
  watchEsbuildTests,
};
export default gulp.series(buildWithoutPackage, injectAppInsightsKey, packageExtension);
