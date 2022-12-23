import { parallel, series } from "gulp";
import {
  compileEsbuild,
  watchEsbuild,
  checkTypeScript,
  watchCheckTypeScript,
  cleanOutput,
  copyWasmFiles,
} from "./typescript";
import { compileTextMateGrammar } from "./textmate";
import { compileView, watchView } from "./webpack";
import { packageExtension } from "./package";
import { injectAppInsightsKey } from "./appInsights";

export const buildWithoutPackage = series(
  cleanOutput,
  parallel(
    compileEsbuild,
    copyWasmFiles,
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
  copyWasmFiles,
  checkTypeScript,
  injectAppInsightsKey,
  compileView,
};
export default series(
  buildWithoutPackage,
  injectAppInsightsKey,
  packageExtension,
);
