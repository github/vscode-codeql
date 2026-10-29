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

The worker edits the exact investigated checkout at `/work` and writes
`/result/result.json`. That artifact becomes `result/result.json` for publication.
Its outcome is `patch` or `needs-maintainer`; only a patch includes file changes.
Exploratory edits are excluded from a diagnosis result.

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
`GITHUB_TOKEN` handles discovery, evaluation, approval, and failure reporting.
Separately scoped `codeql-ci-app` tokens perform retries, merges, and publication.
The worker receives only a read/inference token, never App credentials, and the CLI
is configured to strip that token from tool subprocesses.

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
