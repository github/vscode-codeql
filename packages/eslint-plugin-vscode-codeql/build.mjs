import * as esbuild from "esbuild";

await esbuild.build({
    entryPoints: ["src/index.ts"],
    platform: "node",
    target: "node16",
    bundle: true,
    packages: "external",
    outfile: "lib/index.js",
});
