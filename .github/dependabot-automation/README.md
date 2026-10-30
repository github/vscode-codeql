# Dependabot automation

The automation merges pristine Dependabot updates after configured CI passes,
retries eligible failures once, and asks Copilot to prepare small repairs when
needed. Entering Copilot permanently hands merge ownership to a human.

**Start with `createController().evaluate()` in `controller.cjs`.** Workflow entry
points come first, followed by supporting GitHub operations and pure policy
predicates. The workflow YAML determines which command runs next.

## Execution model

`../workflows/dependabot-automation.yml` discovers eligible open PRs after configured
workflow completions, on an hourly schedule, or through manual dispatch. Each PR
uses `../workflows/dependabot-pr.yml`, with concurrency scoped to that PR across
the whole pipeline. Merge jobs also share a repository-wide concurrency group,
`dependabot-merge-main`, with `queue: max`. This serializes merges into `main`
across automation runs while leaving other jobs parallel. The group allows up to
100 pending merge jobs; additional jobs are canceled if the queue is full.

Discovery excludes held PRs unless native auto-merge needs disarming. It randomly
selects at most 32 candidates per run without replacement, using a partial
Fisher-Yates shuffle. Every candidate has an equal chance of selection, but
selection within a fixed number of runs is not guaranteed. Discovery logs
selected and deferred counts.

The controller is not a long-running process or an in-memory state machine. Each
workflow step creates a fresh controller. Its inputs default to `PR_NUMBER`,
`EXPECTED_SHA`, and the current working directory; tests can supply them explicitly.

State crosses invocations through:

- **GitHub:** PR labels, commit history, and workflow run attempts.
- **Job outputs:** `action` selects the next job; `head` identifies the evaluated
  commit and supplies later jobs' `EXPECTED_SHA`.
- **Artifacts:** evidence goes to the worker; its repair or diagnosis goes to the
  trusted publisher.

## Lifecycle

```text
discover -> evaluate
              |
              +-- ineligible or already held ------------> stop
              +-- non-pristine history ------------------> human review
              +-- missing/running configured CI ----------> wait
              +-- passing CI ----------------------------> approve -> merge
              +-- retryable first failure ----------------> retry -> later evaluate
              `-- other CI failure --> review hold --> Copilot --> publish
                                                                      |
                                                                  human merge
```

Only verified Dependabot-only history is pristine. CI evaluation considers the
latest PR runs for the workflow paths listed in `controller.cjs`, at the current
head. Build Extension, Dependency Review, Code Scanning - CodeQL, and Build
Storybook are always required. The path-filtered Run CLI tests and Bump CLI version
workflows also participate when their PR runs are present; their absence does not
block processing. All selected workflows must finish before a decision is made.
Failed runs can be retried only when all are retryable and still at attempt 1;
manual reruns consume the same budget.

GitHub remains authoritative for merge requirements. An explicit HTTP 405 merge
refusal logs GitHub's reason without adding a review hold or PR comment. The
automation makes one merge attempt per invocation; a later invocation rechecks
eligibility, commit provenance, current-head CI, and existing holds before trying
again. Conflicts and other merge blockers can resolve without human intervention.
Other merge API errors fail the run.

## Workflow entry points

| Workflow job      | Entry point            | Responsibility                                                                       |
| ----------------- | ---------------------- | ------------------------------------------------------------------------------------ |
| Parent `discover` | `discover()`           | Build the eligible PR matrix.                                                        |
| `evaluate`        | `evaluate()`           | Stop, wait, select merging/retry, or hold and collect evidence.                      |
| `retry`           | `retry()`              | Recheck eligibility and rerun failed configured workflows once.                      |
| `merge`           | `approve()`, `merge()` | Revalidate, approve, merge the expected head, or log its refusal.                    |
| `investigate`     | `worker.cjs`           | Run isolated Copilot; produce a repair or explanation.                               |
| `publish`         | `publish()`            | Validate the result and publish it while retaining the hold.                         |
| `report-failure`  | `fail()`               | Require human review after evaluation, retry, or investigation/publication failures. |

## Module and artifact boundaries

| File                  | Responsibility                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------- |
| `controller.cjs`      | Workflow commands, eligibility, transitions, and trusted GitHub writes.                       |
| `evidence.cjs`        | Collect PR text, patches, failed-job logs, and their index.                                   |
| `repair-protocol.cjs` | Validate result shape, allowed repair paths, and size limits. Shared by worker and publisher. |
| `worker.cjs`          | Invoke Copilot and collect actual checkout changes, not model-supplied file contents.         |
| `prompt.txt`          | Diagnosis, migration research, and escalation instructions.                                   |

Evaluation writes `investigation/context.json`, `pr.md`, `diffs/`, and `logs/`.
The index links the separate files and records unavailable or truncated evidence.
Each log retains at most its final 200 KiB, with an explicit truncation notice.
The workflow transfers this bundle to the worker's read-only `/task` mount.

Before inference, the workflow saves the checkout's complete `.git` directory
outside every container mount. The worker edits the exact investigated checkout
at `/work` and writes its raw response to `/handoff/response.json`. It cannot
access the final-result directory.

After the inference container has stopped, the workflow moves the modified `.git`
entry aside without following symlinks and restores the saved metadata, leaving
working-tree edits untouched. It then executes finalization from the trusted
checkout on the runner. The finalizer requires the response file to be a regular
file, collects actual checkout changes, and validates and writes
`result/result.json` for publication. Its outcome is `patch` or `needs-maintainer`;
only a patch includes file changes.
Exploratory edits are excluded from a diagnosis result. Restoring the original
index leaves ignored new files unsupported, even if Copilot force-staged them;
their omission may leave an incomplete repair, and an empty patch is rejected.

The CLI also exports `/diagnostics/transcript.md` and stores session events under
`/diagnostics/copilot/session-state/`, outside the disposable container. The
workflow always attempts to upload the Markdown transcript and `events.jsonl`
files in a separate `copilot-session-<PR>-<workflow attempt>` artifact, retained
for seven days. Interrupted sessions may have only partial event files and no
Markdown export. No CLI configuration or authentication files are uploaded.
Diagnostics are not consumed by the publisher and do not change the repair
protocol.

## Trust boundaries and invariants

Trusted controller and worker instructions are checked out from `main`, never from
the PR. Dispatching a feature branch does not make these checkouts load that branch.

An untrusted PR's workflow completion can trigger discovery, but its event payload
does not select the PR number or checkout SHA. The controller independently
discovers same-repository Dependabot PRs and verifies their commit provenance
before starting an investigation.

`GITHUB_TOKEN` handles discovery, evaluation, approval, and failure reporting.
Separately scoped `codeql-ci-app` tokens perform retries, merges, and publication.
The worker receives only a read/inference token, never App credentials, and the CLI
is configured to strip that token from tool subprocesses.

Dependabot provenance does not make dependency code trustworthy. The investigation
job runs that code inside its restricted container with read/inference permissions.
Finalization runs on the runner only after the container stops and trusted Git
metadata is restored. The raw response and working-tree contents remain untrusted.
The publisher runs separately and validates the untrusted repair artifact before
using App credentials to write changes.

The controller applies `dependency-needs-review` **before** collecting evidence or
starting Copilot. It never removes the hold, even after green CI, a repair, a
failure, or a Dependabot rebase. Maintainers may reset the label deliberately;
the automation never clears it.

The hold blocks future evaluation, retries, approval, and merging. Publication is
the deliberate exception: it requires the existing review hold and rejects its
removal. A repaired PR still needs human review and merge. Native auto-merge is
disabled during evaluation and publication.

Merge and publication recheck PR identity and the expected head. Their GitHub
writes also carry an expected SHA/OID to reject a concurrent head change. Repair
artifacts are validated again by the publisher and never executed as code.

## Local checks

From the repository root:

```sh
node --test .github/dependabot-automation/*.test.cjs
```

The suite covers the automation modules, including real temporary Git repositories
for diff collection. It does not exercise live GitHub permissions, container
isolation, or Copilot's actual diagnosis and repair quality.
