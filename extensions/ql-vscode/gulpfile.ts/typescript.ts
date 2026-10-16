import { dest, parallel, src, watch } from "gulp";
import esbuild from "gulp-esbuild";
import del from "del";
import { pipeline } from "stream/promises";
import { mkdir } from "fs/promises";
import { resolve } from "path";
import { spawn } from "cross-spawn";

/**
 * Type-checks the given TypeScript project using the `tsc` executable from
 * TypeScript 7 (installed as `@typescript/native`).
 */
export async function runTypeScriptCheck(project: string): Promise<void> {
  const proc = spawn(
    resolve(__dirname, "../node_modules/.bin/tsc"),
    ["--noEmit", "--pretty", "false", "--project", project],
    {
      cwd: resolve(__dirname, ".."),
      stdio: ["ignore", "inherit", "inherit"],
    },
  );

  await new Promise((resolve, reject) => {
    proc.on("error", reject);

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(undefined);
      } else {
        // gulp-cli only prints the message (without a stack trace) for errors with `showStack: false`.
        reject(
          Object.assign(
            new Error(`TypeScript type-checking of ${project} failed`),
            { showStack: false },
          ),
        );
      }
    });
  });
}

export function cleanOutput() {
  return del("out/*");
}

export function compileEsbuild() {
  return pipeline(
    src("./src/extension.ts"),
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
    dest("out"),
  );
}

export function watchEsbuild() {
  watch(["src/**/*.ts", "!src/view/**/*.ts"], compileEsbuild);
}

export function checkTypeScript() {
  return runTypeScriptCheck("tsconfig.json");
}

export function watchCheckTypeScript() {
  watch(["src/**/*.ts", "!src/view/**/*.ts"], checkTypeScript);
}

function copyWasmFiles() {
  // We need to copy this file for the source-map package to work. Without this fie, the source-map
  // package is not able to load the WASM file because we are not including the full node_modules
  // directory. In version 0.7.4, it is not possible to call SourceMapConsumer.initialize in Node environments
  // to configure the path to the WASM file. So, source-map will always load the file from `__dirname/mappings.wasm`.
  // In version 0.8.0, it may be possible to do this properly by calling SourceMapConsumer.initialize by
  // using the "browser" field in source-map's package.json to load the WASM file from a given file path.
  return src("node_modules/source-map/lib/mappings.wasm", {
    // WASM is a binary format, so don't try to re-encode it as text.
    encoding: false,
  }).pipe(dest("out"));
}

function copyNativeAddonFiles() {
  // We need to copy these files manually because we only want to include Windows x64 to limit
  // the size of the extension. Windows x64 is the most common platform that requires short path
  // expansion, so we only include this platform.
  // See src/common/short-paths.ts
  if (process.platform !== "win32") {
    return mkdir("out/koffi/win32_x64", { recursive: true });
  }

  return pipeline(
    src("node_modules/@koromix/koffi-win32-x64/win32_x64/*.node", {
      encoding: false,
    }),
    dest("out/koffi/win32_x64"),
  );
}

export const copyModules = parallel(copyWasmFiles, copyNativeAddonFiles);
