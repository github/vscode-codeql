const fs = require("node:fs");
const path = require("node:path");

const maxLogBytes = 200 * 1024;

async function writeInvestigation({
  github,
  repo,
  pr,
  runs,
  outputDir = "investigation",
}) {
  for (const directory of ["diffs", "logs"]) {
    fs.mkdirSync(path.join(outputDir, directory), { recursive: true });
  }
  const write = (file, content) =>
    fs.writeFileSync(path.join(outputDir, file), content);
  write("pr.md", `# ${pr.title}\n\n${pr.body ?? ""}\n`);
  const failed = runs.filter((run) => run.conclusion !== "success");
  const jobs = [];
  for (const run of failed) {
    const runJobs = await github.paginate(
      github.rest.actions.listJobsForWorkflowRun,
      { ...repo, run_id: run.id, filter: "latest", per_page: 100 },
    );
    for (const job of runJobs.filter((job) =>
      ["failure", "timed_out", "cancelled"].includes(job.conclusion),
    )) {
      let log;
      try {
        const { data } =
          await github.rest.actions.downloadJobLogsForWorkflowRun({
            ...repo,
            job_id: job.id,
          });
        const bytes = Buffer.from(data);
        let start = Math.max(0, bytes.length - maxLogBytes);
        // Keep a valid UTF-8 suffix rather than starting inside a character.
        while (
          start > 0 &&
          start < bytes.length &&
          (bytes[start] & 0xc0) === 0x80
        ) {
          start++;
        }
        log = {
          file: `logs/${job.id}.log`,
          originalBytes: bytes.length,
          retainedBytes: bytes.length - start,
          omittedBytes: start,
          truncated: start > 0,
        };
        const notice = log.truncated
          ? `[TRUNCATED: original log was ${log.originalBytes} bytes.\nRetained the final ${log.retainedBytes} bytes; omitted the first ${log.omittedBytes} bytes.\nThe original job URL is recorded in context.json.]\n\n`
          : "";
        write(log.file, notice + bytes.subarray(start).toString("utf8"));
      } catch (error) {
        // Cancelled matrix jobs may never start and therefore have no logs.
        if (error.status !== 404 || job.conclusion !== "cancelled") throw error;
        log = {
          file: null,
          unavailableReason: "No logs available for this cancelled job.",
        };
      }
      jobs.push({
        id: job.id,
        runId: run.id,
        name: job.name,
        url: job.html_url,
        conclusion: job.conclusion,
        log,
      });
    }
  }
  const files = await github.paginate(github.rest.pulls.listFiles, {
    ...repo,
    pull_number: pr.number,
    per_page: 100,
  });
  const patches = files.map(({ filename, patch }, index) => {
    if (typeof patch !== "string" || patch.length === 0) {
      return {
        filename,
        patchFile: null,
        patchUnavailableReason: "GitHub did not provide a textual patch.",
      };
    }
    // Artifact filenames never come from PR filenames or job/check names.
    const patchFile = `diffs/${String(index + 1).padStart(4, "0")}.patch`;
    write(patchFile, patch);
    return { filename, patchFile };
  });
  write(
    "context.json",
    `${JSON.stringify(
      {
        number: pr.number,
        head: pr.head.sha,
        prFile: "pr.md",
        runs: failed.map(({ id, name, path, html_url, run_attempt }) => ({
          id,
          name,
          path,
          url: html_url,
          attempt: run_attempt,
        })),
        files: patches,
        jobs,
      },
      null,
      2,
    )}\n`,
  );
}

module.exports = { writeInvestigation };
