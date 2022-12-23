import { parallel, series } from "gulp";
import { cleanOutput, copyWasmFiles } from "./typescript";
import { compileTextMateGrammar } from "./textmate";
import { compileView, watchView } from "./webview";
import { packageExtension } from "./package";
import { injectAppInsightsKey } from "./appInsights";
import { compileExtension, watchExtension } from "./extension";

export const buildWithoutPackage = series(
  cleanOutput,
  parallel(
    compileExtension,
    copyWasmFiles,
    compileTextMateGrammar,
    compileView,
  ),
);

export const watch = parallel(watchExtension, watchView);

export {
  cleanOutput,
  compileTextMateGrammar,
  compileExtension,
  watchExtension,
  watchView,
  copyWasmFiles,
  injectAppInsightsKey,
  compileView,
};
export default series(
  buildWithoutPackage,
  injectAppInsightsKey,
  packageExtension,
);
