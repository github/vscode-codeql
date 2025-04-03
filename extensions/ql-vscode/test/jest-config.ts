// These are all the packages that DO need to be transformed. All other packages will be ignored.
// These pacakges all use ES modules, so need to be transformed
const transformScopes = [
  "@microsoft",
  "@octokit",
  "@vscode-elements",
  "@lit",
  "@lit-labs",
];
const transformPackages = [
  "before-after-hook",
  "d3",
  "data-uri-to-buffer",
  "delaunator",
  "exenv-es6",
  "fetch-blob",
  "formdata-polyfill",
  "internmap",
  "lit",
  "nanoid",
  "p-queue",
  "p-timeout",
  "robust-predicates",
  "universal-user-agent",
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
