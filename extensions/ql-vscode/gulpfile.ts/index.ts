import { parallel, series } from "gulp";
import {
  compileEsbuild,
  watchEsbuild,
  checkTypeScript,
  watchCheckTypeScript,
  cleanOutput,
} from "./typescript";
import { compileTextMateGrammar } from "./textmate";
import { compileView, watchView } from "./webpack";
import { packageExtension } from "./package";
import { injectAppInsightsKey } from "./appInsights";

export const buildWithoutPackage = series(
  cleanOutput,
  parallel(
    compileEsbuild,
    checkTypeScript,
    compileTextMateGrammar,
    compileView,
  ),
);

export const watch = parallel(watchEsbuild, watchCheckTypeScript, watchView);

export {
  cleanOutput,
  compileTextMateGrammar,
  watchEsbuild,
  watchCheckTypeScript,
  watchView,
  compileEsbuild,
  checkTypeScript,
  injectAppInsightsKey,
  compileView,
};
export default series(
  buildWithoutPackage,
  injectAppInsightsKey,
  packageExtension,
);
