import { dest, src, watch } from "gulp";
import esbuild from "gulp-esbuild";
import { createProject } from "gulp-typescript";
import { goodReporter } from "./typescript";

import chromiumVersion from "./chromium-version.json";

const tsProject = createProject("src/view/tsconfig.json");

export function compileViewEsbuild() {
  return src("./src/view/webview.tsx")
    .pipe(
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
    )
    .pipe(dest("out"));
}

export function watchViewEsbuild() {
  watch(["src/**/*.{ts,tsx}"], compileViewEsbuild);
}

export function checkViewTypeScript() {
  // This doesn't actually output the TypeScript files, it just
  // runs the TypeScript compiler and reports any errors.
  return tsProject.src().pipe(tsProject(goodReporter()));
}

export function watchViewCheckTypeScript() {
  watch(["src/**/*.{ts,tsx}"], checkViewTypeScript);
}
