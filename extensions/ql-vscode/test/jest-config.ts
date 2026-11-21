import type { Config } from "jest";

// These are all the packages that DO need to be transformed. All other packages will be ignored.
// These packages all use ES modules, so need to be transformed
const transformScopes = [
  "@faker-js",
  "@microsoft",
  "@msw",
  "@mswjs",
  "@octokit",
  "@vscode-elements",
  "@lit",
  "@lit-labs",
  "@hpcc-js",
  "@open-draft",
];
const transformPackages = [
  "before-after-hook",
  "chokidar",
  "cookie",
  "data-uri-to-buffer",
  "delaunator",
  "exenv-es6",
  "fetch-blob",
  "formdata-polyfill",
  "headers-polyfill",
  "internmap",
  "lit",
  "msw",
  "outvariant",
  "p-queue",
  "p-timeout",
  "readdirp",
  "rettime",
  "robust-predicates",
  "stream-chain",
  "stream-json",
  "universal-user-agent",
  "until-async",
];
const transformWildcards = ["d3-(.*)", "lit-(.*)"];
const transformPatterns = [
  ...transformScopes.map((scope) => `${scope}/.+`),
  ...transformPackages,
  ...transformWildcards,
];

export const transformIgnorePatterns = [
  `node_modules/(?!(?:${transformPatterns.join("|")})/.*)`,
];

export const dependencyTransform = [
  "babel-jest",
  {
    presets: ["@babel/preset-env"],
    plugins: ["@babel/plugin-transform-modules-commonjs"],
    overrides: [
      {
        // Keep the Wasm lookup relative to the installed interceptor module.
        test: "**/node_modules/@mswjs/interceptors/**",
        plugins: [require.resolve("./babel-import-meta-url.cjs")],
      },
    ],
  },
] satisfies NonNullable<Config["transform"]>[string];

export const mswSourceBabelConfig = {
  // Jest runs these TypeScript files as CommonJS, without a native ESM loader.
  overrides: [
    {
      test: "**/mock-gh-api/mock-gh-api-server.ts",
      plugins: [
        "@babel/plugin-transform-dynamic-import",
        "@babel/plugin-transform-modules-commonjs",
      ],
    },
  ],
};
