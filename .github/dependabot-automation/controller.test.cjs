const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { test } = require("node:test");
const {
  createController,
  canRetry,
  checkState,
  isCandidate,
  isPristine,
  reviewLabel,
  selectRuns,
} = require("./controller.cjs");
const { writeInvestigation } = require("./evidence.cjs");
const { allowedFile, validateResult } = require("./repair-protocol.cjs");
const { collectFiles, run } = require("./worker.cjs");

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
const commit = () => ({
  author: { login: "dependabot[bot]" },
  committer: { login: "web-flow" },
  commit: { verification: { verified: true } },
});
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

function workerWorkspace(t) {
  const workspace = temporaryWorkspace(t);
  const work = path.join(workspace, "work");
  const task = path.join(workspace, "task");
  const output = path.join(workspace, "output");
  for (const directory of [
    path.join(work, "extensions/ql-vscode/src"),
    task,
    output,
  ]) {
    fs.mkdirSync(directory, { recursive: true });
  }
  fs.writeFileSync(path.join(task, "prompt.txt"), "Trusted instructions");
  return { work, task, output };
}

function harness({ workspace } = {}) {
  const state = {
    pr: candidate(),
    commits: [commit()],
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
    retriedRuns: [],
    publication: null,
    comments: [],
    calls: [],
    messages: [],
    outputs: {},
  };
  const record = (operation) => async (args) => {
    state.calls.push(operation);
    return { data: args };
  };
  const github = {
    rest: {
      pulls: {
        get: async ({ pull_number }) => {
          assert.equal(pull_number, state.pr.number);
          return { data: structuredClone(state.pr) };
        },
        list: () => [state.pr],
        listCommits: () => state.commits,
        listFiles: () => state.files,
        listReviews: () => [],
        createReview: record("approve"),
        merge: async (args) => {
          assert.equal(args.sha, head);
          assert.equal(args.merge_method, "merge");
          state.calls.push("merge");
          return { data: { merged: true } };
        },
      },
      actions: {
        listWorkflowRunsForRepo: () => state.runs,
        listJobsForWorkflowRun: () => state.jobs,
        downloadJobLogsForWorkflowRun: async () => ({ data: state.log }),
        reRunWorkflowFailedJobs: async ({ run_id }) => {
          state.calls.push("retry");
          state.retriedRuns.push(run_id);
        },
      },
      issues: {
        getLabel: async () => ({}),
        addLabels: async ({ labels: names }) => {
          state.calls.push(...names);
          state.pr.labels.push(...names.map((name) => ({ name })));
        },
        createComment: async ({ body }) => state.comments.push(body),
      },
    },
    paginate: async (method, args) => method(args),
    graphql: async (query, variables) => {
      if (query.includes("disablePullRequestAutoMerge")) {
        state.calls.push("disable-auto-merge");
      } else {
        assert.match(query, /\bcreateCommitOnBranch\s*\(/);
        state.calls.push("push");
        state.publication = variables.input;
        assert.equal(variables.input.expectedHeadOid, head);
        assert.equal(variables.input.branch.branchName, state.pr.head.ref);
        assert(
          state.pr.labels.some((label) => label.name === reviewLabel),
          "sticky exclusion must precede the push",
        );
      }
    },
  };
  const controller = createController({
    github,
    number: 42,
    expectedSha: head,
    workspace,
    context: {
      repo,
      serverUrl: "https://github.com",
      runId: 123,
    },
    core: {
      info: (message) => state.messages.push(message),
      setOutput: (name, value) => (state.outputs[name] = value),
    },
  });
  const result = (outcome, files = []) => {
    fs.mkdirSync(path.join(workspace, "result"), { recursive: true });
    fs.writeFileSync(
      path.join(workspace, "result/result.json"),
      JSON.stringify({
        outcome,
        summary: "Diagnosis and supporting evidence.",
        files,
      }),
    );
    state.pr.labels.push({ name: reviewLabel });
  };
  return { state, github, controller, result };
}

test("only open, non-draft, same-repository Dependabot PRs qualify", () => {
  const pr = candidate();
  assert(isCandidate(pr, "github/vscode-codeql"));
  for (const change of [
    { state: "closed" },
    { draft: true },
    { user: { login: "someone" } },
    { base: { ref: "release" } },
    { head: { ...pr.head, repo: null } },
    { head: { ...pr.head, ref: "someone/dependabot" } },
  ]) {
    assert(!isCandidate({ ...pr, ...change }, "github/vscode-codeql"));
  }
});

test("verified Dependabot provenance is required for every PR commit", () => {
  const pr = candidate();
  assert(isPristine(pr, [commit()]));
  assert(!isPristine(pr, []));
  assert(!isPristine({ ...pr, commits: 2 }, [commit()]));
  const human = commit();
  human.author.login = "codeql-ci-app[bot]";
  assert(!isPristine(pr, [human]));
  const unsigned = commit();
  unsigned.commit.verification.verified = false;
  assert(!isPristine(pr, [unsigned]));
  const multiple = { ...pr, commits: 2 };
  assert(isPristine(multiple, [commit(), commit()]));
  assert(!isPristine(multiple, [commit(), human]));
  assert(!isPristine(multiple, [unsigned, commit()]));
});

test("waits for configured workflows but ignores unrelated workflows", () => {
  assert.equal(checkState(passing()), "passing");
  assert.equal(checkState(passing().slice(1)), "waiting");
  assert.equal(
    checkState([
      { ...passing()[0], status: "in_progress" },
      ...passing().slice(1),
    ]),
    "waiting",
  );
  assert.equal(
    checkState([
      { ...passing()[0], conclusion: "failure" },
      ...passing().slice(1),
    ]),
    "failing",
  );
  assert.equal(
    checkState([
      ...passing(),
      {
        ...passing()[0],
        id: 20,
        path: ".github/workflows/unrelated.yml",
        conclusion: "failure",
      },
    ]),
    "passing",
  );
  assert.equal(
    checkState([
      { ...passing()[0], conclusion: "skipped" },
      ...passing().slice(1),
    ]),
    "failing",
  );
});

test("uses latest PR run, ignoring dispatches and older failed runs", () => {
  const runs = [
    ...passing(),
    { ...passing()[0], id: 10, conclusion: "failure" },
    { ...passing()[0], id: 11 },
    {
      ...passing()[0],
      id: 12,
      event: "workflow_dispatch",
      conclusion: "failure",
    },
  ];
  assert.equal(checkState(selectRuns(runs)), "passing");
});

test("conditional workflows affect CI state only when PR runs are present", () => {
  for (const name of ["cli-test", "bump-cli"]) {
    const run = {
      ...passing()[0],
      id: 5,
      path: `.github/workflows/${name}.yml`,
    };
    for (const [status, conclusion, expected] of [
      ["queued", null, "waiting"],
      ["in_progress", null, "waiting"],
      ["completed", "failure", "failing"],
      ["completed", "success", "passing"],
    ]) {
      assert.equal(
        checkState([...passing(), { ...run, status, conclusion }]),
        expected,
      );
    }
    assert.equal(checkState([...passing().slice(1), run]), "waiting");
    const runs = [
      ...passing(),
      { ...run, id: 4, conclusion: "failure" },
      run,
      {
        ...run,
        id: 6,
        event: "workflow_dispatch",
        conclusion: "failure",
      },
    ];
    assert.equal(checkState(runs), "passing");
    assert(selectRuns(runs).some((selected) => selected.id === run.id));
  }
});

test("conditional workflow failures follow the retry and investigation lifecycle", async (t) => {
  for (const [name, title] of [
    ["cli-test", "Run CLI tests"],
    ["bump-cli", "Bump CLI version"],
  ]) {
    await t.test(name, async (t) => {
      const workspace = temporaryWorkspace(t);
      const { controller, state } = harness({ workspace });
      const run = {
        ...passing()[0],
        id: 5,
        name: title,
        path: `.github/workflows/${name}.yml`,
        status: "in_progress",
        conclusion: null,
      };
      state.runs.push(run);
      await controller.evaluate();
      assert.equal(state.outputs.action, undefined);
      await assert.rejects(controller.approve(), /no longer eligible/);
      await assert.rejects(controller.merge(), /no longer eligible/);

      run.status = "completed";
      run.conclusion = "failure";
      await controller.evaluate();
      assert.equal(state.outputs.action, "retry");
      await controller.retry();
      assert.deepEqual(state.retriedRuns, [5]);
      assert.deepEqual(state.pr.labels, []);

      run.run_attempt = 2;
      await controller.evaluate();
      assert.equal(state.outputs.action, "investigate");
      assert(state.pr.labels.some((label) => label.name === reviewLabel));
      const evidence = JSON.parse(
        fs.readFileSync(
          path.join(workspace, "investigation/context.json"),
          "utf8",
        ),
      );
      assert.deepEqual(
        evidence.runs.map((failed) => failed.path),
        [run.path],
      );
    });
  }
});

test("retry budget allows one rerun, counting manual attempts too", () => {
  const failed = { conclusion: "failure", run_attempt: 1 };
  assert(canRetry([failed]));
  assert(!canRetry([{ ...failed, run_attempt: 2 }]));
  assert(!canRetry([failed, { ...failed, run_attempt: 2 }]));
  assert(!canRetry([{ ...failed, conclusion: "action_required" }]));
  assert(!canRetry([]));
});

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

test("passing pristine updates are approved then merged at the exact head", async () => {
  const { controller, state } = harness();
  await controller.evaluate();
  assert.equal(state.outputs.action, "merge");
  await controller.approve();
  await controller.merge();
  assert.deepEqual(state.calls, ["approve", "merge"]);
});

test("the review hold excludes green PRs, including after a rebase", async () => {
  const { controller, state } = harness();
  state.pr.labels = [{ name: reviewLabel }];
  state.pr.head.sha = "b".repeat(40);
  await controller.evaluate();
  assert.equal(state.outputs.action, undefined);
  assert.deepEqual(state.calls, []);
});

test("native auto-merge is disabled even for a permanently held PR", async () => {
  const { controller, state } = harness();
  state.pr.labels.push({ name: reviewLabel });
  state.pr.auto_merge = {};
  await controller.evaluate();
  assert.deepEqual(state.calls, ["disable-auto-merge"]);
});

test("an existing current-head Actions approval is not repeated", async () => {
  const { controller, state, github } = harness();
  github.rest.pulls.listReviews = () => [
    {
      user: { login: "github-actions[bot]" },
      state: "APPROVED",
      commit_id: head,
    },
  ];
  await controller.approve();
  assert.deepEqual(state.calls, []);
});

test("unknown commits escalate instead of being mistaken for pristine updates", async () => {
  const { controller, state } = harness();
  state.commits[0].author.login = "someone";
  await controller.evaluate();
  assert(state.calls.includes(reviewLabel));
  assert.match(state.comments[0], /other than verified Dependabot/);
  assert.equal(state.outputs.action, undefined);
});

test("failure places a hold and writes an index with separate searchable evidence", async (t) => {
  const workspace = temporaryWorkspace(t);
  const investigation = path.join(workspace, "investigation");
  const { controller, state } = harness({ workspace });
  state.pr.auto_merge = {};
  state.runs[0].conclusion = "failure";
  state.runs[0].run_attempt = 2;
  state.files = [
    {
      filename: "extensions/ql-vscode/src/AGENTS.md",
      patch: "@@ -1 +1 @@\n-old\n+new\n",
    },
    { filename: "extensions/ql-vscode/package-lock.json" },
  ];
  await controller.evaluate();
  assert.deepEqual(state.calls, ["disable-auto-merge", reviewLabel]);
  assert.equal(state.outputs.action, "investigate");
  const context = JSON.parse(
    fs.readFileSync(path.join(investigation, "context.json"), "utf8"),
  );
  assert.equal(context.head, head);
  const description = fs.readFileSync(
    path.join(investigation, context.prFile),
    "utf8",
  );
  assert(description.includes(state.pr.title));
  assert(description.includes(state.pr.body));
  assert.deepEqual(
    context.runs.map((run) => run.id),
    [state.runs[0].id],
  );
  const patch = context.files.find(
    (file) => file.filename === state.files[0].filename,
  );
  assert.equal(path.dirname(patch.patchFile), "diffs");
  assert(!patch.patchFile.includes("AGENTS"));
  assert.equal(
    fs.readFileSync(path.join(investigation, patch.patchFile), "utf8"),
    state.files[0].patch,
  );
  const unavailable = context.files.find(
    (file) => file.filename === state.files[1].filename,
  );
  assert.equal(unavailable.patchFile, null);
  assert(unavailable.patchUnavailableReason);
  assert.equal(context.jobs.length, 1);
  const job = context.jobs[0];
  assert.equal(job.id, state.jobs[0].id);
  assert.equal(job.runId, context.runs[0].id);
  assert.equal(job.url, state.jobs[0].html_url);
  assert.equal(path.dirname(job.log.file), "logs");
  assert.equal(
    fs.readFileSync(path.join(investigation, job.log.file), "utf8"),
    state.log,
  );
  assert(!JSON.stringify(context).includes("Failure log"));
  assert(!JSON.stringify(context).includes(state.pr.body));
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

test("GitHub merge refusals remain eligible for later reconciliation", async (t) => {
  for (const reason of [
    "Required merge checks have not passed",
    "Base branch was modified. Review and try the merge again.",
    "Pull Request has merge conflicts",
  ]) {
    await t.test(reason, async (t) => {
      const workspace = temporaryWorkspace(t);
      const { controller, state, github } = harness({ workspace });
      const merge = github.rest.pulls.merge;
      let attempts = 0;
      github.rest.pulls.merge = async () => {
        attempts++;
        throw Object.assign(new Error(reason), { status: 405 });
      };
      await controller.evaluate();
      assert.equal(state.outputs.action, "merge");
      await controller.merge();
      assert.equal(attempts, 1);
      assert.deepEqual(state.calls, []);
      assert.deepEqual(state.pr.labels, []);
      assert.deepEqual(state.comments, []);
      assert(
        state.messages.some(
          (message) =>
            message.includes("PR #42") &&
            message.includes(reason) &&
            message.includes("eligible for later reconciliation"),
        ),
      );
      assert(!fs.existsSync(path.join(workspace, "investigation")));

      state.outputs = {};
      state.runs[0].status = "in_progress";
      await controller.evaluate();
      assert.equal(state.outputs.action, undefined);
      await assert.rejects(controller.merge(), /no longer eligible/);
      assert.equal(attempts, 1);

      state.outputs = {};
      state.runs[0].status = "completed";
      github.rest.pulls.merge = merge;
      await controller.evaluate();
      assert.equal(state.outputs.action, "merge");
      await controller.approve();
      await controller.merge();
      assert.deepEqual(state.calls, ["approve", "merge"]);
    });
  }
});

test("merge authentication, stale-head, and unexpected API errors propagate", async (t) => {
  for (const status of [403, 409, 422, 500]) {
    await t.test(`HTTP ${status}`, async () => {
      const { controller, github, state } = harness();
      github.rest.pulls.merge = async () => {
        throw Object.assign(new Error(`Merge error ${status}`), { status });
      };
      await assert.rejects(
        controller.merge(),
        new RegExp(`Merge error ${status}`),
      );
      assert.deepEqual(state.messages, []);
      assert.deepEqual(state.pr.labels, []);
      assert.deepEqual(state.comments, []);
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

test("patch publication retains the existing review hold after the App push", async (t) => {
  const { controller, state, result } = harness({
    workspace: temporaryWorkspace(t),
  });
  result("patch", [
    { path: "extensions/ql-vscode/src/a.ts", content: "fixed \u20ac\n" },
    { path: "extensions/ql-vscode/test/new.test.ts", content: "new test\n" },
    { path: "extensions/ql-vscode/src/deleted.ts", content: null },
  ]);
  await controller.publish();
  assert.deepEqual(state.calls, ["push"]);
  assert.equal(
    state.publication.branch.repositoryNameWithOwner,
    "github/vscode-codeql",
  );
  assert.deepEqual(
    state.publication.fileChanges.additions.map(({ path, contents }) => ({
      path,
      content: Buffer.from(contents, "base64").toString("utf8"),
    })),
    [
      { path: "extensions/ql-vscode/src/a.ts", content: "fixed \u20ac\n" },
      { path: "extensions/ql-vscode/test/new.test.ts", content: "new test\n" },
    ],
  );
  assert.deepEqual(state.publication.fileChanges.deletions, [
    { path: "extensions/ql-vscode/src/deleted.ts" },
  ]);
  assert(state.pr.labels.some((label) => label.name === reviewLabel));
  assert.match(state.comments[0], /not.*automatically merged/);
  await assert.rejects(controller.merge(), /no longer eligible/);
});

test("changed heads and removed holds reject publication", async (t) => {
  for (const [name, change, error] of [
    [
      "changed head",
      (state) => {
        state.pr.head.sha = "b".repeat(40);
      },
      /stale operation/,
    ],
    [
      "removed hold",
      (state) => {
        state.pr.labels = [];
      },
      /hold was removed/,
    ],
  ]) {
    await t.test(name, async (t) => {
      const { controller, state, result } = harness({
        workspace: temporaryWorkspace(t),
      });
      result("patch", [
        { path: "extensions/ql-vscode/src/a.ts", content: "fixed" },
      ]);
      change(state);
      await assert.rejects(controller.publish(), error);
      assert.deepEqual(state.calls, []);
    });
  }
});

test("a failed review-hold write prevents starting Copilot", async (t) => {
  const workspace = temporaryWorkspace(t);
  const { controller, state, github } = harness({ workspace });
  state.runs[0].conclusion = "failure";
  state.runs[0].run_attempt = 2;
  github.rest.issues.addLabels = async () => {
    throw new Error("Permission denied");
  };
  await assert.rejects(controller.evaluate(), /Permission denied/);
  assert.equal(state.outputs.action, undefined);
  assert(!fs.existsSync(path.join(workspace, "investigation")));
  assert(!state.calls.includes("push"));
});

test("a failed push leaves the sticky exclusion intact", async (t) => {
  const { controller, state, github, result } = harness({
    workspace: temporaryWorkspace(t),
  });
  result("patch", [
    { path: "extensions/ql-vscode/src/a.ts", content: "fixed" },
  ]);
  github.graphql = async () => {
    throw new Error("Head changed");
  };
  await assert.rejects(controller.publish(), /Head changed/);
  assert(state.pr.labels.some((label) => label.name === reviewLabel));
});

test("one pre-Copilot retry keeps a pristine PR eligible for automatic merging", async (t) => {
  const workspace = temporaryWorkspace(t);
  const { controller, state } = harness({ workspace });
  state.runs[0].conclusion = "failure";
  state.runs[2].conclusion = "timed_out";
  state.runs.push({
    ...state.runs[0],
    id: 99,
    path: ".github/workflows/unrelated.yml",
  });
  await controller.evaluate();
  assert.equal(state.outputs.action, "retry");
  assert.equal(state.outputs.head, head);
  assert(!fs.existsSync(path.join(workspace, "investigation")));
  await controller.retry();
  assert.deepEqual(state.retriedRuns, [1, 3]);
  assert.deepEqual(state.calls, ["retry", "retry"]);
  assert.deepEqual(state.pr.labels, []);
  state.runs = passing();
  await controller.evaluate();
  assert.equal(state.outputs.action, "merge");
  await controller.approve();
  await controller.merge();
  assert.deepEqual(state.calls, ["retry", "retry", "approve", "merge"]);
});

test("entering Copilot stays manual-merge-only after green CI and Dependabot rebases", async (t) => {
  const { controller, state } = harness({ workspace: temporaryWorkspace(t) });
  state.runs[0].conclusion = "failure";
  state.runs[0].run_attempt = 2;
  await controller.evaluate();
  assert.equal(state.outputs.action, "investigate");
  assert(state.pr.labels.some((label) => label.name === reviewLabel));
  state.outputs = {};
  state.runs = passing();
  await controller.evaluate();
  assert.equal(state.outputs.action, undefined);
  await assert.rejects(controller.approve(), /no longer eligible/);
  await assert.rejects(controller.merge(), /no longer eligible/);
  state.pr.head.sha = "b".repeat(40);
  await controller.evaluate();
  assert.equal(state.outputs.action, undefined);
  assert(!state.calls.includes("retry"));
  assert.deepEqual(state.calls, [reviewLabel]);
});

test("non-retryable workflow failures go directly to the permanent handoff", async (t) => {
  const { controller, state } = harness({ workspace: temporaryWorkspace(t) });
  state.runs[0].conclusion = "action_required";
  state.jobs = [];
  await controller.evaluate();
  assert.equal(state.outputs.action, "investigate");
  assert.deepEqual(state.calls, [reviewLabel]);
});

test("retry rechecks identity, holds, provenance, CI and attempt budget", async (t) => {
  for (const [name, change, error] of [
    [
      "changed head",
      (state) => {
        state.pr.head.sha = "b".repeat(40);
      },
      /stale operation/,
    ],
    [
      "review hold",
      (state) => {
        state.pr.labels.push({ name: reviewLabel });
      },
      /no longer eligible/,
    ],
    [
      "non-Dependabot commit",
      (state) => {
        state.commits[0].author.login = "human";
      },
      /no longer eligible/,
    ],
    [
      "mixed retry budgets",
      (state) => {
        state.runs[1].conclusion = "failure";
        state.runs[1].run_attempt = 2;
      },
    ],
    [
      "running CI",
      (state) => {
        state.runs[0].status = "in_progress";
      },
    ],
    [
      "green CI",
      (state) => {
        state.runs = passing();
      },
    ],
  ]) {
    await t.test(name, async () => {
      const { controller, state } = harness();
      state.runs[0].conclusion = "failure";
      change(state);
      if (error) {
        await assert.rejects(controller.retry(), error);
      } else {
        await controller.retry();
      }
      assert.deepEqual(state.calls, []);
      assert.equal(state.comments.length, 0);
    });
  }
});

test("retry API failures propagate", async () => {
  const { controller, state, github } = harness();
  state.runs[0].conclusion = "failure";
  github.rest.actions.reRunWorkflowFailedJobs = async () => {
    throw new Error("Cannot rerun CI");
  };
  await assert.rejects(controller.retry(), /Cannot rerun CI/);
});

test("unsupported Copilot outcomes cannot rerun CI or remove the hold", async (t) => {
  const { controller, state, result } = harness({
    workspace: temporaryWorkspace(t),
  });
  result("retry");
  await assert.rejects(controller.publish(), /Invalid Copilot result/);
  assert.deepEqual(state.calls, []);
  assert(state.pr.labels.some((label) => label.name === reviewLabel));
});

test("worker failure keeps the same permanent review boundary", async (t) => {
  const { controller, state } = harness({ workspace: temporaryWorkspace(t) });
  state.runs[0].conclusion = "failure";
  state.runs[0].run_attempt = 2;
  await controller.evaluate();
  await controller.fail();
  assert(state.pr.labels.every((label) => label.name === reviewLabel));
  assert.match(state.comments[0], /Human review is required/);
  state.outputs = {};
  state.runs = passing();
  await controller.evaluate();
  assert.equal(state.outputs.action, undefined);
  assert(!state.calls.includes("retry"));
  assert(!state.calls.includes("push"));
});

test("explanations publish without patches and retain a permanent hold", async (t) => {
  const { controller, state, result } = harness({
    workspace: temporaryWorkspace(t),
  });
  result("needs-maintainer");
  await controller.publish();
  assert(state.calls.includes(reviewLabel));
  assert.match(state.comments[0], /Diagnosis and supporting evidence/);
  assert(!state.calls.includes("push"));
});

test("rechecks provenance, labels, CI, and head immediately before merging", async (t) => {
  for (const [name, change, error] of [
    [
      "new hold",
      (state) => {
        state.pr.labels.push({ name: reviewLabel });
      },
      /no longer eligible/,
    ],
    [
      "failing CI",
      (state) => {
        state.runs[0].conclusion = "failure";
      },
      /no longer eligible/,
    ],
    [
      "non-Dependabot commit",
      (state) => {
        state.commits[0].author.login = "someone";
      },
      /no longer eligible/,
    ],
    [
      "changed head",
      (state) => {
        state.pr.head.sha = "b".repeat(40);
      },
      /stale operation/,
    ],
  ]) {
    await t.test(name, async () => {
      const { controller, state } = harness();
      await controller.approve();
      change(state);
      await assert.rejects(controller.merge(), error);
      assert.deepEqual(state.calls, ["approve"]);
    });
  }
});

test("worker collects tracked edits, new tests, and deletions", (t) => {
  const work = temporaryWorkspace(t);
  const git = (...args) =>
    execFileSync("git", args, { cwd: work, stdio: "pipe" });
  git("init");
  git("config", "user.name", "Test");
  git("config", "user.email", "test@example.com");
  const source = path.join(work, "extensions/ql-vscode/src");
  fs.mkdirSync(source, { recursive: true });
  fs.writeFileSync(path.join(source, "a.ts"), "before");
  fs.writeFileSync(path.join(source, "deleted.ts"), "remove");
  git("add", ".");
  git("commit", "-m", "Initial");
  fs.writeFileSync(path.join(source, "a.ts"), "after");
  fs.unlinkSync(path.join(source, "deleted.ts"));
  fs.writeFileSync(path.join(source, "new.ts"), "new");
  const files = collectFiles(work);
  assert.deepEqual(files, [
    { path: "extensions/ql-vscode/src/a.ts", content: "after" },
    { path: "extensions/ql-vscode/src/deleted.ts", content: null },
    { path: "extensions/ql-vscode/src/new.ts", content: "new" },
  ]);
  fs.symlinkSync("a.ts", path.join(source, "link.ts"));
  assert.throws(() => collectFiles(work), /Non-regular/);
});

test("worker requests transcript export, unattended execution, and scoped permissions", (t) => {
  const { work, task, output } = workerWorkspace(t);
  run({
    work,
    task,
    output,
    invoke: (_command, args) => {
      assert(args.includes("--share=/diagnostics/transcript.md"));
      assert(args.includes("-s"));
      assert(args.includes("--no-ask-user"));
      const tools = args.flatMap((arg, index) =>
        arg === "--allow-tool" ? [args[index + 1]] : [],
      );
      assert.deepEqual(
        tools.filter((tool) => tool.startsWith("github-mcp-server")),
        ["github-mcp-server(web_search)"],
      );
      assert.equal(args[args.indexOf("--secret-env-vars") + 1], "GITHUB_TOKEN");
      assert(!args.includes("--allow-all"));
      assert(!args.includes("--allow-all-tools"));
      assert(!args.includes("--allow-all-urls"));
      const urls = args.flatMap((arg, index) =>
        arg === "--allow-url" ? [args[index + 1]] : [],
      );
      for (const url of urls) {
        assert.match(url, /^https:\/\/[a-z0-9.-]+$/);
      }
      return {
        status: 0,
        stdout: JSON.stringify({
          outcome: "needs-maintainer",
          summary: "Explanation",
        }),
      };
    },
  });
});

test("worker returns a diagnosis without publishing exploratory edits", (t) => {
  const { work, task, output } = workerWorkspace(t);
  const filename = path.join(work, "extensions/ql-vscode/src/a.ts");
  fs.writeFileSync(filename, "before");
  run({
    work,
    task,
    output,
    invoke: () => {
      fs.writeFileSync(filename, "exploratory edit");
      return {
        status: 0,
        stdout: JSON.stringify({
          outcome: "needs-maintainer",
          summary: "Requires a broader change.",
          files: [
            {
              path: "extensions/ql-vscode/src/a.ts",
              content: "exploratory edit",
            },
          ],
        }),
      };
    },
  });
  const result = JSON.parse(
    fs.readFileSync(path.join(output, "result.json"), "utf8"),
  );
  assert.equal(result.outcome, "needs-maintainer");
  assert.equal(result.summary, "Requires a broader change.");
  assert.deepEqual(result.files, []);
  assert.equal(fs.readFileSync(filename, "utf8"), "exploratory edit");
});

test("worker rejects malformed output, nonzero exits, and timeouts", (t) => {
  const { work, task, output } = workerWorkspace(t);
  const invoke = (result) => () => result;
  for (const result of [
    { status: 0, stdout: "not JSON" },
    { status: 0, stdout: JSON.stringify({ outcome: "merge", summary: "Bad" }) },
    {
      status: 0,
      stdout: JSON.stringify({ outcome: "retry", summary: "Flaky" }),
    },
    { status: 1 },
    { error: new Error("Timed out") },
  ]) {
    assert.throws(() =>
      run({
        work,
        task,
        output,
        invoke: invoke(result),
      }),
    );
    assert(!fs.existsSync(path.join(output, "result.json")));
  }
});

test("worker publishes only the actual checkout diff for a patch result", (t) => {
  const { work, task, output } = workerWorkspace(t);
  const git = (...args) =>
    execFileSync("git", args, { cwd: work, stdio: "pipe" });
  git("init");
  git("config", "user.name", "Test");
  git("config", "user.email", "test@example.com");
  fs.writeFileSync(`${work}/extensions/ql-vscode/src/a.ts`, "before");
  git("add", ".");
  git("commit", "-m", "Initial");
  run({
    work,
    task,
    output,
    invoke: () => {
      fs.writeFileSync(`${work}/extensions/ql-vscode/src/a.ts`, "after");
      return {
        status: 0,
        stdout: JSON.stringify({
          outcome: "patch",
          summary: "Migrated the dependency API.",
          files: [{ path: ".github/workflows/main.yml", content: "untrusted" }],
        }),
      };
    },
  });
  const result = JSON.parse(
    fs.readFileSync(path.join(output, "result.json"), "utf8"),
  );
  assert.deepEqual(result.files, [
    { path: "extensions/ql-vscode/src/a.ts", content: "after" },
  ]);
});
