import type { ComparePerformanceDescriptionData } from "../../log-insights/performance-comparison";

// XXX same as in dca.ts, but importing that file here hangs esbuild?!
const dcaControllerRepository = {
  owner: "github",
  repo: "codeql-dca-main",
};
// XXX same as in config.ts, but importing that file here hangs esbuild?!
const GITHUB_URL = new URL("https://github.com");

type Props = ComparePerformanceDescriptionData & {
  kind: "remote-logs";
};

/**
 * Gets the reports URL for an experiment.
 */
function getExperimentUrl(experimentName: string) {
  return `${GITHUB_URL.toString()}${dcaControllerRepository.owner}/${dcaControllerRepository.repo}/tree/data/${experimentName}/reports`;
}

function getActionsRunUrl(run: { repository: string; run_id: number }) {
  return `${GITHUB_URL.toString()}${run.repository}/actions/runs/${run.run_id}`;
}

const TargetRow = ({
  kind,
  target,
}: {
  kind: string;
  target: Props["fromTarget"] | Props["toTarget"];
}) => {
  return (
    // TODO make these rows richer
    <tr>
      <td>{kind}</td>
      <td>{target.info.target_id}</td>
      <td>{target.info.variant_id}</td>
      <td>{target.info.source_id}</td>
      <td>
        <a href={getActionsRunUrl(target.downloads["evaluator-logs"])}>
          {target.downloads["evaluator-logs"].run_id}
        </a>
      </td>
    </tr>
  );
};
const TargetTable = ({
  fromTarget,
  toTarget,
}: {
  fromTarget: Props["fromTarget"];
  toTarget: Props["toTarget"];
}) => {
  // show a table of the targets and their details: fullTargetId, variantId, source repository, runId
  return (
    <table>
      <thead>
        <tr>
          <th>Kind</th>
          <th>Target</th>
          <th>Variant</th>
          <th>Source</th>
          <th>Run</th>
        </tr>
      </thead>
      <tbody>
        <TargetRow kind="from" target={fromTarget} />
        <TargetRow kind="to" target={toTarget} />
      </tbody>
    </table>
  );
};

export const ComparePerformanceRemoteLogsDescription = ({
  experimentName,
  fromTarget,
  toTarget,
}: Props) => {
  return (
    <div>
      <p>
        <strong>
          Comparison for{" "}
          <a href={getExperimentUrl(experimentName)}>{experimentName}</a>
        </strong>
      </p>
      {TargetTable({ fromTarget, toTarget })}
    </div>
  );
};
