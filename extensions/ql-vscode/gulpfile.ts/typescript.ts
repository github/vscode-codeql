import { resolve } from "path";
import { dest, src } from "gulp";
import del from "del";

export function cleanOutput() {
  return del(`${resolve(__dirname, "..", "out")}/*`);
}

export function copyWasmFiles() {
  // We need to copy this file for the source-map package to work. Without this fie, the source-map
  // package is not able to load the WASM file because we are not including the full node_modules
  // directory. In version 0.7.4, it is not possible to call SourceMapConsumer.initialize in Node environments
  // to configure the path to the WASM file. So, source-map will always load the file from `__dirname/mappings.wasm`.
  // In version 0.8.0, it may be possible to do this properly by calling SourceMapConsumer.initialize by
  // using the "browser" field in source-map's package.json to load the WASM file from a given file path.
  return src("node_modules/source-map/lib/mappings.wasm").pipe(dest("out"));
}
