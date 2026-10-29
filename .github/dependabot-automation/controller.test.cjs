const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { writeInvestigation } = require("./evidence.cjs");
const { allowedFile, validateResult } = require("./repair-protocol.cjs");

const head = "a".repeat(40);
const repo = { owner: "github", repo: "vscode-codeql" };
const workflows = ["main", "dependency-review", "codeql", "build-storybook"];
const passing = () =>
  workflows.map((name, index) => ({
    id: index + 1,
    name,
    path: `.github/workflows/${name}.yml`,
    html_url: `https://github.com/github/vscode-codeql/actions/runs/${index + 1}`,
    head_sha: head,
    event: "pull_request",
    status: "completed",
    conclusion: "success",
    run_attempt: 1,
  }));
const candidate = () => ({
  number: 42,
  title: "Bump a dependency",
  body: "PR description and upstream release links.",
  state: "open",
  draft: false,
  user: { login: "dependabot[bot]" },
  base: { ref: "main" },
  head: {
    sha: head,
    ref: "dependabot/npm/example",
    repo: { full_name: "github/vscode-codeql" },
  },
  commits: 1,
  labels: [],
  node_id: "PR_42",
});

function temporaryWorkspace(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "dependabot-test-"));
  t.after(() => {
    fs.rmSync(directory, { recursive: true });
  });
  return directory;
}

function harness() {
  const state = {
    pr: candidate(),
    runs: passing(),
    files: [],
    jobs: [
      {
        id: 100,
        name: "Test",
        conclusion: "failure",
        html_url:
          "https://github.com/github/vscode-codeql/actions/runs/1/job/100",
        check_run_url:
          "https://api.github.com/repos/github/vscode-codeql/check-runs/500",
      },
    ],
    log: "Failure log",
  };
  const github = {
    rest: {
      pulls: {
        listFiles: () => state.files,
      },
      actions: {
        listJobsForWorkflowRun: () => state.jobs,
        downloadJobLogsForWorkflowRun: async () => ({ data: state.log }),
      },
    },
    paginate: async (method, args) => method(args),
  };
  return { state, github };
}

test("rejects unsafe paths, binaries, excessive patches, and malformed outcomes", () => {
  assert(allowedFile("extensions/ql-vscode/test/unit-tests/example.test.ts"));
  for (const name of [
    "../src/a.ts",
    "extensions/ql-vscode/src/../package.json",
    "extensions/ql-vscode/src/AGENTS.md",
    "extensions/ql-vscode/package-lock.json",
    ".github/workflows/main.yml",
    "extensions/ql-vscode/test/e2e/docker/Dockerfile",
  ]) {
    assert(!allowedFile(name));
  }
  const file = {
    path: "extensions/ql-vscode/src/example.ts",
    content: "fixed",
  };
  const patch = { outcome: "patch", summary: "Explanation", files: [file] };
  assert.doesNotThrow(() => validateResult(patch));
  for (const invalid of [
    {},
    { ...patch, outcome: "merge" },
    { ...patch, summary: "" },
    { ...patch, files: [] },
    { ...patch, files: [file, file] },
    { ...patch, files: [{ ...file, path: ".github/workflows/main.yml" }] },
    { ...patch, files: [{ ...file, content: "\0" }] },
    { ...patch, files: [{ ...file, content: "a".repeat(100_001) }] },
    { outcome: "retry", summary: "Try again", files: [] },
  ]) {
    assert.throws(() => validateResult(invalid));
  }
});

test("log retention uses a 200 KiB UTF-8 suffix with explicit truncation", async (t) => {
  const limit = 200 * 1024;
  for (const [name, data, retained, omitted] of [
    ["below limit", "a".repeat(limit - 1), "a".repeat(limit - 1), 0],
    ["exact limit", "a".repeat(limit), "a".repeat(limit), 0],
    ["over limit", "a".repeat(limit) + "z", "a".repeat(limit - 1) + "z", 1],
    [
      "UTF-8 boundary",
      Buffer.from("\u20ac" + "z".repeat(limit - 1)),
      "z".repeat(limit - 1),
      3,
    ],
  ]) {
    await t.test(name, async (t) => {
      const outputDir = temporaryWorkspace(t);
      const { github, state } = harness();
      state.log = data;
      await writeInvestigation({
        github,
        repo,
        pr: state.pr,
        runs: [{ ...state.runs[0], conclusion: "failure" }],
        outputDir,
      });
      const context = JSON.parse(
        fs.readFileSync(path.join(outputDir, "context.json"), "utf8"),
      );
      const log = context.jobs[0].log;
      const content = fs.readFileSync(path.join(outputDir, log.file), "utf8");
      assert.equal(log.originalBytes, Buffer.byteLength(data));
      assert.equal(log.retainedBytes, Buffer.byteLength(retained));
      assert.equal(log.omittedBytes, omitted);
      assert.equal(log.truncated, omitted > 0);
      if (omitted) {
        assert(
          content.startsWith(
            `[TRUNCATED: original log was ${log.originalBytes} bytes.`,
          ),
        );
        assert(content.includes(`omitted the first ${omitted} bytes`));
        assert.equal(content.slice(content.indexOf("\n\n") + 2), retained);
      } else {
        assert.equal(content, retained);
      }
    });
  }
});

test("only cancelled-job log 404s become explicitly unavailable evidence", async (t) => {
  for (const [name, conclusion, status] of [
    ["cancelled job without logs", "cancelled", 404],
    ["failed job without logs", "failure", 404],
    ["cancelled job with an API error", "cancelled", 403],
  ]) {
    await t.test(name, async (t) => {
      const outputDir = temporaryWorkspace(t);
      const { state, github } = harness();
      state.jobs[0].conclusion = conclusion;
      github.rest.actions.downloadJobLogsForWorkflowRun = async () => {
        throw Object.assign(new Error("Cannot download log"), { status });
      };
      const write = () =>
        writeInvestigation({
          github,
          repo,
          pr: state.pr,
          runs: [{ ...state.runs[0], conclusion: "failure" }],
          outputDir,
        });
      if (conclusion === "cancelled" && status === 404) {
        await write();
        const context = JSON.parse(
          fs.readFileSync(path.join(outputDir, "context.json"), "utf8"),
        );
        assert.equal(context.jobs[0].log.file, null);
        assert.match(context.jobs[0].log.unavailableReason, /cancelled job/);
        assert(!fs.existsSync(path.join(outputDir, "logs/100.log")));
      } else {
        await assert.rejects(write(), /Cannot download log/);
      }
    });
  }
});
