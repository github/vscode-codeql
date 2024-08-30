export const transformIgnorePatterns = [
  // These use ES modules, so need to be transformed
  "node_modules/(?!(?:@vscode/webview-ui-toolkit|@microsoft/.+|@octokit/.+|before-after-hook|d3|d3-(.*)|delaunator|exenv-es6|internmap|nanoid|p-queue|p-timeout|robust-predicates|universal-user-agent)/.*)",
];
