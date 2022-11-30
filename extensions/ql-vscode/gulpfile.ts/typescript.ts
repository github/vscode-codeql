import { gray, red } from "ansi-colors";
import { dest, watch } from "gulp";
import { init, write } from "gulp-sourcemaps";
import * as ts from "gulp-typescript";
import * as del from "del";

function goodReporter(): ts.reporter.Reporter {
  return {
    error: (error, typescript) => {
      if (error.tsFile) {
        console.log(
          "[" +
            gray("gulp-typescript") +
            "] " +
            red(
              error.fullFilename +
                "(" +
                (error.startPosition!.line + 1) +
                "," +
                error.startPosition!.character +
                "): ",
            ) +
            "error TS" +
            error.diagnostic.code +
            ": " +
            typescript.flattenDiagnosticMessageText(
              error.diagnostic.messageText,
              "\n",
            ),
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
    ? del(tsProject.projectDirectory + "/out/*")
    : Promise.resolve();
}

export function compileTypeScript() {
  return tsProject
    .src()
    .pipe(init())
    .pipe(tsProject(goodReporter()))
    .pipe(
      write(".", {
        includeContent: false,
        sourceRoot: ".",
      }),
    )
    .pipe(dest("out"));
}

export function watchTypeScript() {
  watch("src/**/*.ts", compileTypeScript);
}
