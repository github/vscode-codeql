import { gray, red } from "ansi-colors";
import { dest, src, watch } from "gulp";
import esbuild from "gulp-esbuild";
import ts from "gulp-typescript";
import del from "del";

function goodReporter(): ts.reporter.Reporter {
  return {
    error: (error, typescript) => {
      if (error.tsFile) {
        console.log(
          `[${gray("gulp-typescript")}] ${red(
            `${error.fullFilename}(${error.startPosition!.line + 1},${
              error.startPosition!.character
            }): `,
          )}error TS${
            error.diagnostic.code
          }: ${typescript.flattenDiagnosticMessageText(
            error.diagnostic.messageText,
            "\n",
          )}`,
        );
      } else {
        console.log(error.message);
      }
    },
  };
}

const tsProject = ts.createProject("tsconfig.json");

export function cleanOutput() {
  return tsProject.projectDirectory
    ? del(`${tsProject.projectDirectory}/out/*`)
    : Promise.resolve();
}

export function compileEsbuild() {
  return src("./src/extension.ts")
    .pipe(
      esbuild({
        outfile: "extension.js",
        bundle: true,
        external: ["vscode", "fsevents"],
        format: "cjs",
        platform: "node",
        target: "es2020",
        sourcemap: "linked",
        sourceRoot: "..",
        loader: {
          ".node": "copy",
        },
      }),
    )
    .pipe(dest("out"));
}

export function watchEsbuild() {
  watch("src/**/*.ts", compileEsbuild);
}

export function checkTypeScript() {
  // This doesn't actually output the TypeScript files, it just
  // runs the TypeScript compiler and reports any errors.
  return tsProject.src().pipe(tsProject(goodReporter()));
}

export function watchCheckTypeScript() {
  watch("src/**/*.ts", checkTypeScript);
}

export function copyWasmFiles() {
  // We need to copy this file for the source-map package to work. Without this fie, the source-map
  // package is not able to load the WASM file because we are not including the full node_modules
  // directory. In version 0.7.4, it is not possible to call SourceMapConsumer.initialize in Node environments
  // to configure the path to the WASM file. So, source-map will always load the file from `__dirname/mappings.wasm`.
  // In version 0.8.0, it may be possible to do this properly by calling SourceMapConsumer.initialize by
  // using the "browser" field in source-map's package.json to load the WASM file from a given file path.
  return src("../../node_modules/source-map/lib/mappings.wasm").pipe(
    dest("out"),
  );
}
