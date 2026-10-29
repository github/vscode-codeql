const fs = require("node:fs");
const { execFileSync, spawnSync } = require("node:child_process");
const { validateResult } = require("./repair-protocol.cjs");

// Curated upstream docs for our npm, Actions, and Docker dependencies. Never
// derive approvals from untrusted package metadata or allow multi-tenant wildcards.
// These are CLI URL approvals, not a container-wide network egress policy.
const documentationHosts = [
  "github.com",
  "raw.githubusercontent.com",
  "api.github.com",
  "docs.github.com",
  "registry.npmjs.org",
  "docs.npmjs.com",
  "nodejs.org",
  "developer.mozilla.org",
  "www.typescriptlang.org",
  "typescriptlang.org",
  "babel.dev",
  "eslint.org",
  "typescript-eslint.io",
  "prettier.io",
  "vite.dev",
  "gulpjs.com",
  "typestrong.org",
  "esbuild.github.io",
  "rolldown.rs",
  "oxc.rs",
  "jestjs.io",
  "testing-library.com",
  "playwright.dev",
  "mswjs.io",
  "fakerjs.dev",
  "kulshekhar.github.io",
  "react.dev",
  "storybook.js.org",
  "floating-ui.com",
  "styled-components.com",
  "ajv.js.org",
  "koffi.dev",
  "hpcc-systems.github.io",
  "d3js.org",
  "graphviz.org",
  "code.visualstudio.com",
  "vscode-elements.github.io",
  "learn.microsoft.com",
  "octokit.github.io",
  "typicode.github.io",
  "docs.docker.com",
  "hub.docker.com",
  "coder.com",
  // Historical versions needed when comparing old and new dependency APIs.
  "v7.vite.dev",
  "v10.fakerjs.dev",
  "v1.mswjs.io",
];

function collectFiles(cwd) {
  const git = (...args) =>
    execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 2_000_000 });
  // Include new tests as well as tracked edits, without staging or committing.
  const names = new Set(
    [
      ...git("diff", "--name-only", "-z", "HEAD").split("\0"),
      ...git("ls-files", "--others", "--exclude-standard", "-z").split("\0"),
    ].filter(Boolean),
  );
  return [...names].map((name) => {
    const filename = `${cwd}/${name}`;
    if (!fs.existsSync(filename)) return { path: name, content: null };
    if (!fs.lstatSync(filename).isFile()) {
      throw new Error(`Non-regular repair file rejected: ${name}`);
    }
    const bytes = fs.readFileSync(filename);
    if (bytes.length > 100_000)
      throw new Error(`Repair file too large: ${name}`);
    const content = bytes.toString("utf8");
    if (!Buffer.from(content).equals(bytes)) {
      throw new Error(`Non-UTF-8 repair file rejected: ${name}`);
    }
    return { path: name, content };
  });
}

function run({
  work = "/work",
  task = "/task",
  output = "/result",
  invoke = spawnSync,
} = {}) {
  const prompt = fs.readFileSync(`${task}/prompt.txt`, "utf8");
  // Only a read/inference GITHUB_TOKEN enters this container. CLI strips it from
  // tool subprocesses; the codeql-ci-app private key is never available here.
  const result = invoke(
    "copilot",
    [
      "-p",
      prompt,
      "-s",
      "--share=/diagnostics/transcript.md",
      "--no-ask-user",
      "--model",
      "gpt-6.1-terra",
      "--max-ai-credits",
      "100",
      // Built-in GitHub MCP supplies web_search using the worker's token.
      // Expose only search plus local repair tools, not other GitHub API tools.
      "--disable-mcp-server",
      "github",
      "--add-github-mcp-tool",
      "web_search",
      "--available-tools",
      "apply_patch,bash,glob,rg,view,web_fetch,web_search",
      "--add-dir",
      task,
      "--add-dir",
      work,
      "--secret-env-vars",
      "GITHUB_TOKEN",
      ...documentationHosts.flatMap((host) => [
        "--allow-url",
        `https://${host}`,
      ]),
      "--allow-tool",
      "github-mcp-server(web_search)",
      "--allow-tool",
      "write",
      "--allow-tool",
      "shell(git diff:*)",
      "--allow-tool",
      "shell(git show:*)",
      "--allow-tool",
      "shell(git log:*)",
      "--allow-tool",
      "shell(npm:*)",
      "--allow-tool",
      "shell(npx:*)",
      "--allow-tool",
      "shell(node:*)",
    ],
    {
      cwd: `${work}/extensions/ql-vscode`,
      encoding: "utf8",
      timeout: 20 * 60 * 1000,
      maxBuffer: 2_000_000,
      env: process.env,
    },
  );
  if (result.error) throw result.error;
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0)
    throw new Error(`Copilot exited with ${result.status}`);
  const response = JSON.parse(result.stdout);
  const outputResult = validateResult({
    outcome: response.outcome,
    summary: response.summary,
    // Discard all exploratory edits when handing the problem to a maintainer.
    files: response.outcome === "patch" ? collectFiles(work) : [],
  });
  fs.writeFileSync(`${output}/result.json`, JSON.stringify(outputResult));
}

if (require.main === module) run();
module.exports = { collectFiles, run };
