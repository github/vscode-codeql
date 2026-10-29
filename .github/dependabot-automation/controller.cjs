const fs = require("node:fs");
const path = require("node:path");
const { writeInvestigation } = require("./evidence.cjs");
const { validateResult } = require("./repair-protocol.cjs");

const reviewLabel = "dependency-needs-review";
const requiredWorkflows = [
  ".github/workflows/main.yml",
  ".github/workflows/dependency-review.yml",
  ".github/workflows/codeql.yml",
  ".github/workflows/build-storybook.yml",
];
const conditionalWorkflows = [
  ".github/workflows/cli-test.yml",
  ".github/workflows/bump-cli.yml",
];

// Each workflow step creates a fresh instance; durable PR state lives on GitHub.
// See README.md for the lifecycle, job mapping, and trust boundaries.
function createController({
  github,
  context,
  core,
  number = Number(process.env.PR_NUMBER),
  expectedSha = process.env.EXPECTED_SHA,
  workspace = process.cwd(),
}) {
  const repo = context.repo;
  const issue = { ...repo, issue_number: number };
  const pull = { ...repo, pull_number: number };
  const repository = `${repo.owner}/${repo.repo}`;
  return {
    discover,
    evaluate,
    retry,
    approve,
    merge,
    publish,
    fail,
  };

  async function discover() {
    const pulls = await github.paginate(github.rest.pulls.list, {
      ...repo,
      state: "open",
      base: "main",
      per_page: 100,
    });
    const candidates = pulls.filter(
      (pr) =>
        isCandidate(pr, repository) &&
        (!hasAutomationHold(pr) || Boolean(pr.auto_merge)),
    );
    const batchSize = 32;
    const count = Math.min(batchSize, candidates.length);
    for (let index = 0; index < count; index++) {
      const other =
        index + Math.floor(Math.random() * (candidates.length - index));
      [candidates[index], candidates[other]] = [
        candidates[other],
        candidates[index],
      ];
    }
    const selected = candidates.slice(0, count);
    core.info(
      `Selected ${selected.length} of ${candidates.length} eligible PRs; deferred ${candidates.length - selected.length}.`,
    );
    core.setOutput("prs", JSON.stringify(selected.map((pr) => pr.number)));
    core.setOutput("has-prs", selected.length > 0);
  }

  async function evaluate() {
    const pr = await getPr();
    if (!isCandidate(pr, repository)) return;
    // Do not leave native auto-merge armed while diagnosis can change PR state.
    await disableAutoMerge(pr);
    if (hasAutomationHold(pr)) return;
    if (!(await hasPristineHistory(pr))) {
      await requireHumanReview(
        "This PR contains commits other than verified Dependabot changes.",
      );
      return;
    }
    const { runs, state } = await readCiState(pr.head.sha);
    core.info(`PR #${number} at ${pr.head.sha}: ${state}`);
    if (state === "waiting") return;
    core.setOutput("head", pr.head.sha);
    if (state === "passing") {
      core.setOutput("action", "merge");
      return;
    }
    if (canRetry(runs.filter((run) => run.conclusion !== "success"))) {
      core.setOutput("action", "retry");
      return;
    }
    // Entering Copilot is a one-way merge handoff, even if it makes no edits.
    await addLabel(reviewLabel);
    await writeInvestigation({
      github,
      repo,
      pr,
      runs,
      outputDir: path.join(workspace, "investigation"),
    });
    core.setOutput("action", "investigate");
  }

  async function retry() {
    const pr = await requireExpectedPr();
    if (hasAutomationHold(pr) || !(await hasPristineHistory(pr))) {
      throw new Error("PR is no longer eligible for an automatic retry");
    }
    const { runs, state } = await readCiState(pr.head.sha);
    const failed = runs.filter((run) => run.conclusion !== "success");
    if (state !== "failing" || !canRetry(failed)) {
      core.info(
        "CI or its attempt count changed; no retry requested. The next reconciliation will re-evaluate.",
      );
      return;
    }
    // The scoped App token reruns jobs before Copilot, without changing code.
    await postComment(
      "Retrying failed jobs once before Copilot investigation. If CI passes, this pristine PR remains eligible for automatic merging.",
    );
    for (const run of failed) {
      await github.rest.actions.reRunWorkflowFailedJobs({
        ...repo,
        run_id: run.id,
      });
    }
  }

  async function approve() {
    const pr = await requireMergeEligiblePr();
    // GITHUB_TOKEN supplies the required approval, not an App review bypass.
    const reviews = await github.paginate(github.rest.pulls.listReviews, {
      ...pull,
      per_page: 100,
    });
    const previous = reviews
      .filter((review) => review.user?.login === "github-actions[bot]")
      .at(-1);
    if (previous?.state === "APPROVED" && previous.commit_id === pr.head.sha) {
      return;
    }
    await github.rest.pulls.createReview({
      ...pull,
      commit_id: pr.head.sha,
      event: "APPROVE",
      body: "Verified Dependabot-only changes; configured PR CI workflows passed.",
    });
  }

  async function merge() {
    const pr = await requireMergeEligiblePr();
    // The codeql-ci-app installation token is an allowed push actor on main.
    // GitHub still enforces reviews and checks; sha prevents a head-change race.
    try {
      const result = await github.rest.pulls.merge({
        ...pull,
        sha: pr.head.sha,
        merge_method: "merge",
      });
      if (!result.data.merged) throw new Error(result.data.message);
    } catch (error) {
      // GitHub, not our CI snapshot, decides whether all merge rules pass.
      // A 405 is an explicit merge refusal; auth/stale-head/API errors propagate.
      if (error.status !== 405) throw error;
      core.info(
        `GitHub refused automatic merging of PR #${pr.number}: ${error.message}. Leaving the PR eligible for later reconciliation.`,
      );
    }
  }

  async function publish() {
    const pr = await requireExpectedPr();
    await disableAutoMerge(pr);
    if (!hasAutomationHold(pr)) {
      throw new Error("Human-review hold was removed; refusing to publish");
    }
    const result = validateResult(
      JSON.parse(
        fs.readFileSync(path.join(workspace, "result/result.json"), "utf8"),
      ),
    );
    switch (result.outcome) {
      case "needs-maintainer":
        await requireHumanReview(result.summary);
        break;
      case "patch":
        await commitRepair(pr, result.files);
        await postComment(
          `${result.summary}\n\nPublished a Copilot repair. This PR will **not** be automatically merged; a human must review and merge it after CI.`,
        );
        break;
      default:
        throw new Error(
          `Unsupported Copilot result outcome: ${result.outcome}`,
        );
    }
  }

  async function fail() {
    const pr = await getPr();
    if (!isCandidate(pr, repository)) return;
    await requireHumanReview(
      "The automation failed, timed out, or returned an invalid result. See the automation run for details. Human review is required; no further automatic repair will be attempted.",
    );
  }

  async function requireExpectedPr() {
    const pr = await getPr();
    if (!isCandidate(pr, repository) || pr.head.sha !== expectedSha) {
      throw new Error(
        "PR closed, changed identity, or advanced; refusing stale operation",
      );
    }
    return pr;
  }

  async function requireMergeEligiblePr() {
    const pr = await requireExpectedPr();
    if (
      hasAutomationHold(pr) ||
      !(await hasPristineHistory(pr)) ||
      (await readCiState(pr.head.sha)).state !== "passing"
    ) {
      throw new Error("PR is no longer eligible for automatic merging");
    }
    return pr;
  }

  async function getPr() {
    return (await github.rest.pulls.get(pull)).data;
  }

  async function hasPristineHistory(pr) {
    return isPristine(
      pr,
      await github.paginate(github.rest.pulls.listCommits, {
        ...pull,
        per_page: 100,
      }),
    );
  }

  async function readCiState(sha) {
    const runs = selectRuns(
      await github.paginate(github.rest.actions.listWorkflowRunsForRepo, {
        ...repo,
        event: "pull_request",
        head_sha: sha,
        per_page: 100,
      }),
    );
    return { runs, state: checkState(runs) };
  }

  function hasAutomationHold(pr) {
    return pr.labels.some((label) => label.name === reviewLabel);
  }

  async function requireHumanReview(summary) {
    await addLabel(reviewLabel);
    await postComment(
      `${summary}\n\nAutomatic merging is blocked pending a maintainer decision.`,
    );
  }

  async function disableAutoMerge(pr) {
    if (pr.auto_merge) {
      await github.graphql(
        "mutation($id: ID!) { disablePullRequestAutoMerge(input: {pullRequestId: $id}) { clientMutationId } }",
        { id: pr.node_id },
      );
    }
  }

  async function addLabel(name) {
    // Labels are authoritative PR-level state. Maintainers may reset them manually.
    // Create missing labels explicitly; other API errors must stop the operation.
    try {
      await github.rest.issues.getLabel({ ...repo, name });
    } catch (error) {
      if (error.status !== 404) throw error;
      try {
        await github.rest.issues.createLabel({
          ...repo,
          name,
          color: "FBCA04",
          description: "Dependabot automation state; remove only deliberately",
        });
      } catch (creationError) {
        if (creationError.status !== 422) throw creationError;
        await github.rest.issues.getLabel({ ...repo, name });
      }
    }
    await github.rest.issues.addLabels({ ...issue, labels: [name] });
  }

  async function commitRepair(pr, files) {
    const additions = files
      .filter((file) => file.content !== null)
      .map((file) => ({
        path: file.path,
        contents: Buffer.from(file.content).toString("base64"),
      }));
    const deletions = files
      .filter((file) => file.content === null)
      .map((file) => ({ path: file.path }));
    // Use the GitHub API, not git apply/checkout or scripts from the artifact.
    // expectedHeadOid atomically rejects publication after a rebase/new push.
    await github.graphql(
      `mutation($input: CreateCommitOnBranchInput!) {
        createCommitOnBranch(input: $input) { commit { oid } }
      }`,
      {
        input: {
          branch: {
            repositoryNameWithOwner: repository,
            branchName: pr.head.ref,
          },
          expectedHeadOid: pr.head.sha,
          message: {
            headline: "Adapt to dependency update",
            body: "Prepared by Copilot; requires human review.",
          },
          fileChanges: { additions, deletions },
        },
      },
    );
  }

  async function postComment(body) {
    return github.rest.issues.createComment({
      ...issue,
      body: `### Dependabot automation\n\n${body}\n\n[Automation run](${context.serverUrl}/${repository}/actions/runs/${context.runId})`,
    });
  }
}

function isCandidate(pr, repository) {
  return (
    pr.state === "open" &&
    !pr.draft &&
    pr.user?.login === "dependabot[bot]" &&
    pr.base.ref === "main" &&
    pr.head.repo?.full_name === repository &&
    pr.head.ref.startsWith("dependabot/")
  );
}

function isPristine(pr, commits) {
  // Dependabot commits are signed by GitHub, whose committer is web-flow.
  return (
    commits.length > 0 &&
    commits.length === pr.commits &&
    commits.every(
      (commit) =>
        commit.author?.login === "dependabot[bot]" &&
        ["dependabot[bot]", "web-flow"].includes(commit.committer?.login) &&
        commit.commit.verification.verified,
    )
  );
}

function selectRuns(runs) {
  const latest = new Map();
  for (const run of runs) {
    if (
      run.event !== "pull_request" ||
      (!requiredWorkflows.includes(run.path) &&
        !conditionalWorkflows.includes(run.path))
    )
      continue;
    if (!latest.has(run.path) || run.id > latest.get(run.path).id) {
      latest.set(run.path, run);
    }
  }
  return [...latest.values()];
}

function checkState(runs) {
  runs = selectRuns(runs);
  if (
    requiredWorkflows.some((name) => !runs.some((run) => run.path === name)) ||
    runs.some((run) => run.status !== "completed")
  ) {
    return "waiting";
  }
  return runs.every((run) => run.conclusion === "success")
    ? "passing"
    : "failing";
}

function canRetry(runs) {
  return (
    runs.length > 0 &&
    runs.every(
      (run) =>
        ["failure", "timed_out", "cancelled"].includes(run.conclusion) &&
        run.run_attempt === 1,
    )
  );
}

module.exports = {
  createController,
  canRetry,
  checkState,
  isCandidate,
  isPristine,
  reviewLabel,
  selectRuns,
};
