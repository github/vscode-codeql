import * as gulp from 'gulp';
import { compileTypeScript, watchTypeScript, copyViewCss, cleanOutput, watchCss } from './typescript';
import { compileTextMateGrammar } from './textmate';
import { copyTestData } from './tests';
import { compileView, watchView } from './webpack';
import { packageExtension } from './package';
import { injectAppInsightsKey } from './appInsights';

export const buildWithoutPackage =
  gulp.series(
    cleanOutput,
    gulp.parallel(
      compileTypeScript, compileTextMateGrammar, compileView, copyTestData, copyViewCss
    )
  );

export {
  cleanOutput,
  compileTextMateGrammar,
  watchTypeScript,
  watchView,
  compileTypeScript,
  copyTestData,
  injectAppInsightsKey,
  compileView,
  watchCss
};
export default gulp.series(buildWithoutPackage, injectAppInsightsKey, packageExtension);
