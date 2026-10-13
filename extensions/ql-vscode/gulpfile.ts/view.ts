import { dest, src, watch } from "gulp";
import esbuild from "gulp-esbuild";
import { runTypeScriptCheck } from "./typescript";

import { pipeline } from "stream/promises";
import chromiumVersion from "./chromium-version.json";

export function compileViewEsbuild() {
  return pipeline(
    src("./src/view/webview.tsx"),
    esbuild({
      outfile: "webview.js",
      bundle: true,
      format: "iife",
      platform: "browser",
      target: `chrome${chromiumVersion.chromiumVersion}`,
      jsx: "automatic",
      sourcemap: "linked",
      sourceRoot: "..",
      loader: {
        ".ttf": "file",
      },
    }),
    dest("out"),
  );
}

export function watchViewEsbuild() {
  watch(["src/**/*.{ts,tsx}"], compileViewEsbuild);
}

export function checkViewTypeScript() {
  return runTypeScriptCheck("src/view/tsconfig.json");
}

export function watchViewCheckTypeScript() {
  watch(["src/**/*.{ts,tsx}"], checkViewTypeScript);
}
