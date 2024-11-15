import { styled } from "styled-components";
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

function getRepoTreeUrl(source: { repository: string; sha: string }) {
  return `${GITHUB_URL.toString()}${source.repository}/tree/${source.sha}`;
}

const TargetRow = ({
  kind,
  target,
  info,
}: {
  kind: string;
  target: Props["fromTarget"] | Props["toTarget"];
  info: Props["info"];
}) => {
  const targetObj = info.targets[target];
  const sourceObj = info.sources[targetObj.info.source_id];
  return (
    // TODO make these rows richer
    <tr>
      <td>{kind}</td>
      <td>{target}</td>
      <td>
        <a href={getRepoTreeUrl(sourceObj.info)}>
          {sourceObj.info.repository}@{sourceObj.info.sha.slice(0, 7)}
        </a>
      </td>
      <td>
        <a href={getActionsRunUrl(targetObj.downloads["evaluator-logs"])}>
          {targetObj.downloads["evaluator-logs"].run_id}
        </a>
      </td>
    </tr>
  );
};

const TargetTableDiv = styled.div`
  table {
    border-collapse: collapse;
  }

  table td {
    padding: 5px;
    border: 1px solid #aaa;
  }

  tr.head {
    background: #eee;
  }
`;

const TargetTable = ({
  fromTarget,
  toTarget,
  info,
}: Pick<Props, "fromTarget" | "toTarget" | "info">) => {
  // show a table of the targets and their details: fullTargetId, variantId, source repository, runId
  return (
    <table>
      <thead>
        <tr>
          <th>Kind</th>
          <th>Target</th>
          <th>Source</th>
          <th>Run</th>
        </tr>
      </thead>
      <tbody>
        <TargetRow kind="from" target={fromTarget} info={info} />
        <TargetRow kind="to" target={toTarget} info={info} />
      </tbody>
    </table>
  );
};

export const ComparePerformanceRemoteLogsDescription = ({
  experimentName,
  fromTarget,
  toTarget,
  info,
}: Props) => {
  return (
    <div>
      <p>
        <strong>
          Comparison for{" "}
          <a href={getExperimentUrl(experimentName)}>{experimentName}</a>
        </strong>
      </p>
      <TargetTableDiv>
        <TargetTable {...{ fromTarget, toTarget, info }} />
      </TargetTableDiv>
    </div>
  );
};
