import { parallel, series } from "gulp";
import {
  compileEsbuild,
  watchEsbuild,
  checkTypeScript,
  watchCheckTypeScript,
  cleanOutput,
  copyModules,
} from "./typescript";
import { compileTextMateGrammar } from "./textmate";
import { packageExtension } from "./package";
import { injectAppInsightsKey } from "./appInsights";
import {
  checkViewTypeScript,
  compileViewEsbuild,
  watchViewCheckTypeScript,
  watchViewEsbuild,
} from "./view";

export const buildWithoutPackage = series(
  cleanOutput,
  parallel(
    compileEsbuild,
    copyModules,
    checkTypeScript,
    compileTextMateGrammar,
    compileViewEsbuild,
    checkViewTypeScript,
  ),
);

export const watch = parallel(
  // Always build first, so that we don't have to run build manually
  compileEsbuild,
  compileViewEsbuild,
  watchEsbuild,
  watchCheckTypeScript,
  watchViewEsbuild,
  watchViewCheckTypeScript,
);

export {
  cleanOutput,
  compileTextMateGrammar,
  watchEsbuild,
  watchCheckTypeScript,
  watchViewEsbuild,
  compileEsbuild,
  copyModules,
  checkTypeScript,
  injectAppInsightsKey,
  compileViewEsbuild,
  checkViewTypeScript,
};
export default series(
  buildWithoutPackage,
  injectAppInsightsKey,
  packageExtension,
);
