import { series, parallel } from "gulp";
import { compileTypeScript, watchTypeScript, cleanOutput } from "./typescript";
import { compileTextMateGrammar } from "./textmate";
import { copyTestData, watchTestData } from "./tests";
import { compileView, watchView } from "./webpack";
import { packageExtension } from "./package";
import { injectAppInsightsKey } from "./appInsights";

export const buildWithoutPackage = series(
  cleanOutput,
  parallel(
    compileTypeScript,
    compileTextMateGrammar,
    compileView,
    copyTestData,
  ),
);

export {
  cleanOutput,
  compileTextMateGrammar,
  watchTypeScript,
  watchView,
  compileTypeScript,
  copyTestData,
  watchTestData,
  injectAppInsightsKey,
  compileView,
};
export default series(
  buildWithoutPackage,
  injectAppInsightsKey,
  packageExtension,
);
