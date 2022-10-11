import * as gulp from 'gulp';
import { compileTypeScript, watchTypeScript, cleanOutput } from './typescript';
import { compileTextMateGrammar } from './textmate';
import { copyTestData } from './tests';
import { compileView, watchView } from './webpack';
import { packageExtension } from './package';
import { injectAppInsightsKey } from './appInsights';

export const buildWithoutPackage =
  gulp.series(
    cleanOutput,
    gulp.parallel(
      compileTypeScript, compileTextMateGrammar, compileView, copyTestData
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
};
export default gulp.series(buildWithoutPackage, injectAppInsightsKey, packageExtension);
