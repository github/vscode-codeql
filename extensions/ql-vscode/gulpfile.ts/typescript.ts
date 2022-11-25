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
