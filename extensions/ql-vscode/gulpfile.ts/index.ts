import * as gulp from 'gulp';
import { compileTypeScript, watchTypeScript, copyViewCss } from './typescript';
import { compileTextMateGrammar } from './textmate';
import { copyTestData } from './tests';
import { compileView } from './webpack';
import { packageExtension } from './package';
import { injectAppInsightsKey } from './appInsights';

export const buildWithoutPackage =
  gulp.parallel(
    compileTypeScript, compileTextMateGrammar, compileView, copyTestData, copyViewCss
  );

export { compileTextMateGrammar, watchTypeScript, compileTypeScript, copyTestData, injectAppInsightsKey };
export default gulp.series(buildWithoutPackage, injectAppInsightsKey, packageExtension);
