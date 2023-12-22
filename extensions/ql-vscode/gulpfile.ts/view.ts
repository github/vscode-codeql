import { dest, src, watch } from "gulp";
import esbuild from "gulp-esbuild";
import { createProject } from "gulp-typescript";
import { goodReporter } from "./typescript";

const tsProject = createProject("src/view/tsconfig.json");

export function compileViewEsbuild() {
  return src("./src/view/webview.tsx")
    .pipe(
      esbuild({
        outfile: "webview.js",
        bundle: true,
        format: "iife",
        platform: "browser",
        target: "chrome114", // Electron 25, VS Code 1.85
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
  watch(["src/view/**/*.{ts,tsx}"], compileViewEsbuild);
}

export function checkViewTypeScript() {
  // This doesn't actually output the TypeScript files, it just
  // runs the TypeScript compiler and reports any errors.
  return tsProject.src().pipe(tsProject(goodReporter()));
}

export function watchViewCheckTypeScript() {
  watch(["src/view/**/*.{ts,tsx}"], checkViewTypeScript);
}
