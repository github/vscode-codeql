import { useMemo, useState, Fragment } from "react";
import type {
  SetPerformanceComparisonQueries,
  ToComparePerformanceViewMessage,
} from "../../common/interface-types";
import { useMessageFromExtension } from "../common/useMessageFromExtension";
import type {
  PerformanceComparisonDataFromLog,
  PipelineSummary,
} from "../../log-insights/performance-comparison";
import { formatDecimal } from "../../common/number";
import { styled } from "styled-components";
import { Codicon, ViewTitle, WarningBox } from "../common";
import { abbreviateRASteps } from "./RAPrettyPrinter";

const enum AbsentReason {
  NotSeen = "NotSeen",
  CacheHit = "CacheHit",
  Sentinel = "Sentinel",
}

interface OptionalValue {
  absentReason: AbsentReason | undefined;
  tuples: number;
}

interface PredicateInfo extends OptionalValue {
  pipelines: Record<string, PipelineSummary>;
}

class ComparisonDataset {
  public nameToIndex = new Map<string, number>();
  public cacheHitIndices: Set<number>;
  public sentinelEmptyIndices: Set<number>;

  constructor(public data: PerformanceComparisonDataFromLog) {
    const { names } = data;
    const { nameToIndex } = this;
    for (let i = 0; i < names.length; i++) {
      nameToIndex.set(names[i], i);
    }
    this.cacheHitIndices = new Set(data.cacheHitIndices);
    this.sentinelEmptyIndices = new Set(data.sentinelEmptyIndices);
  }

  getTupleCountInfo(name: string): PredicateInfo {
    const { data, nameToIndex, cacheHitIndices, sentinelEmptyIndices } = this;
    const index = nameToIndex.get(name);
    if (index == null) {
      return {
        tuples: 0,
        absentReason: AbsentReason.NotSeen,
        pipelines: {},
      };
    }
    const tupleCost = data.tupleCosts[index];
    let absentReason: AbsentReason | undefined;
    if (tupleCost === 0) {
      if (sentinelEmptyIndices.has(index)) {
        absentReason = AbsentReason.Sentinel;
      } else if (cacheHitIndices.has(index)) {
        absentReason = AbsentReason.CacheHit;
      }
    }
    return {
      tuples: tupleCost,
      absentReason,
      pipelines: data.pipelineSummaryList[index],
    };
  }
}

function renderAbsoluteValue(x: OptionalValue) {
  switch (x.absentReason) {
    case AbsentReason.NotSeen:
      return <AbsentNumberCell>n/a</AbsentNumberCell>;
    case AbsentReason.CacheHit:
      return <AbsentNumberCell>cache hit</AbsentNumberCell>;
    case AbsentReason.Sentinel:
      return <AbsentNumberCell>sentinel empty</AbsentNumberCell>;
    default:
      return <NumberCell>{formatDecimal(x.tuples)}</NumberCell>;
  }
}

function renderDelta(x: number) {
  const sign = x > 0 ? "+" : "";
  return (
    <NumberCell>
      {sign}
      {formatDecimal(x)}
    </NumberCell>
  );
}

function orderBy<T>(fn: (x: T) => number | string) {
  return (x: T, y: T) => {
    const fx = fn(x);
    const fy = fn(y);
    return fx === fy ? 0 : fx < fy ? -1 : 1;
  };
}

const ChevronCell = styled.td`
  width: 1em !important;
`;

const NameHeader = styled.th`
  text-align: left;
`;

const NumberHeader = styled.th`
  text-align: right;
  width: 10em !important;
`;

const NameCell = styled.td``;

const NumberCell = styled.td`
  text-align: right;
  width: 10em !important;
`;

const AbsentNumberCell = styled.td`
  text-align: right;
  color: var(--vscode-disabledForeground);

  tr.expanded & {
    color: inherit;
  }
  width: 10em !important;
`;

const Table = styled.table`
  border-collapse: collapse;
  width: 100%;
  border-spacing: 0;
  background-color: var(--vscode-background);
  color: var(--vscode-foreground);
  & td {
    padding: 0.5em;
  }
  & th {
    padding: 0.5em;
  }
  &.expanded {
    border: 1px solid var(--vscode-list-activeSelectionBackground);
    margin-bottom: 1em;
  }
`;

const PredicateTR = styled.tr`
  cursor: pointer;

  &.expanded {
    background-color: var(--vscode-list-activeSelectionBackground);
    color: var(--vscode-list-activeSelectionForeground);
    position: sticky;
    top: 0;
  }

  & .codicon-chevron-right {
    visibility: hidden;
  }

  &:hover:not(.expanded) {
    background-color: var(--vscode-list-hoverBackground);
    & .codicon-chevron-right {
      visibility: visible;
    }
  }
`;

const PipelineStepTR = styled.tr`
  & td {
    padding-top: 0.3em;
    padding-bottom: 0.3em;
  }
`;

interface PipelineStepProps {
  before: number | undefined;
  after: number | undefined;
  step: string;
}

function PipelineStep(props: PipelineStepProps) {
  let { before, after, step } = props;
  if (before != null && before < 0) {
    before = undefined;
  }
  if (after != null && after < 0) {
    after = undefined;
  }
  const delta = before != null && after != null ? after - before : undefined;
  return (
    <PipelineStepTR>
      <ChevronCell />
      <NumberCell>{before != null ? formatDecimal(before) : ""}</NumberCell>
      <NumberCell>{after != null ? formatDecimal(after) : ""}</NumberCell>
      {delta != null ? renderDelta(delta) : <td></td>}
      <NameCell>{step}</NameCell>
    </PipelineStepTR>
  );
}

function Chevron({ expanded }: { expanded: boolean }) {
  return <Codicon name={expanded ? "chevron-down" : "chevron-right"} />;
}

function withToggledValue<T>(set: Set<T>, value: T) {
  const result = new Set(set);
  if (result.has(value)) {
    result.delete(value);
  } else {
    result.add(value);
  }
  return result;
}

export function ComparePerformance(_: Record<string, never>) {
  const [data, setData] = useState<
    SetPerformanceComparisonQueries | undefined
  >();

  useMessageFromExtension<ToComparePerformanceViewMessage>(
    (msg) => {
      setData(msg);
    },
    [setData],
  );

  const datasets = useMemo(
    () =>
      data == null
        ? undefined
        : {
            from: new ComparisonDataset(data.from),
            to: new ComparisonDataset(data.to),
          },
    [data],
  );

  const [expandedPredicates, setExpandedPredicates] = useState<Set<string>>(
    () => new Set<string>(),
  );

  const [hideCacheHits, setHideCacheHits] = useState(false);

  if (!datasets) {
    return <div>Loading performance comparison...</div>;
  }

  const { from, to } = datasets;

  const nameSet = new Set(from.data.names);
  for (const name of to.data.names) {
    nameSet.add(name);
  }

  let hasCacheHitMismatch = false;

  const rows = Array.from(nameSet)
    .map((name) => {
      const before = from.getTupleCountInfo(name);
      const after = to.getTupleCountInfo(name);
      if (before.tuples === after.tuples) {
        return undefined!;
      }
      if (
        before.absentReason === AbsentReason.CacheHit ||
        after.absentReason === AbsentReason.CacheHit
      ) {
        hasCacheHitMismatch = true;
        if (hideCacheHits) {
          return undefined!;
        }
      }
      const diff = after.tuples - before.tuples;
      return { name, before, after, diff };
    })
    .filter((x) => !!x)
    .sort(orderBy((row) => row.diff));

  let totalBefore = 0;
  let totalAfter = 0;
  let totalDiff = 0;

  for (const row of rows) {
    totalBefore += row.before.tuples;
    totalAfter += row.after.tuples;
    totalDiff += row.diff;
  }

  return (
    <>
      <ViewTitle>Performance comparison</ViewTitle>
      {hasCacheHitMismatch && (
        <WarningBox>
          <strong>Inconsistent cache hits</strong>
          <br />
          Some predicates had a cache hit on one side but not the other. For
          more accurate results, try running the{" "}
          <strong>CodeQL: Clear Cache</strong> command before each query.
          <br />
          <br />
          <label>
            <input
              type="checkbox"
              checked={hideCacheHits}
              onChange={() => setHideCacheHits(!hideCacheHits)}
            />
            Hide predicates with cache hits
          </label>
        </WarningBox>
      )}
      <Table>
        <thead>
          <tr>
            <ChevronCell />
            <NumberHeader>Before</NumberHeader>
            <NumberHeader>After</NumberHeader>
            <NumberHeader>Delta</NumberHeader>
            <NameHeader>Predicate</NameHeader>
          </tr>
        </thead>
      </Table>
      {rows.map((row) => (
        <Table
          key={row.name}
          className={expandedPredicates.has(row.name) ? "expanded" : ""}
        >
          <tbody>
            <PredicateTR
              className={expandedPredicates.has(row.name) ? "expanded" : ""}
              key={"main"}
              onClick={() =>
                setExpandedPredicates(
                  withToggledValue(expandedPredicates, row.name),
                )
              }
            >
              <ChevronCell>
                <Chevron expanded={expandedPredicates.has(row.name)} />
              </ChevronCell>
              {renderAbsoluteValue(row.before)}
              {renderAbsoluteValue(row.after)}
              {renderDelta(row.diff)}
              <NameCell>{row.name}</NameCell>
            </PredicateTR>
            {expandedPredicates.has(row.name) && (
              <>
                {collatePipelines(
                  row.before.pipelines,
                  row.after.pipelines,
                ).map(({ name, first, second }, pipelineIndex) => (
                  <Fragment key={pipelineIndex}>
                    <tr>
                      <td></td>
                      <NumberHeader>{first != null && "Before"}</NumberHeader>
                      <NumberHeader>{second != null && "After"}</NumberHeader>
                      <NumberHeader>
                        {first != null && second != null && "Delta"}
                      </NumberHeader>
                      <NameHeader>
                        Tuple counts for &apos;{name}&apos; pipeline
                        {first == null
                          ? " (after)"
                          : second == null
                            ? " (before)"
                            : ""}
                      </NameHeader>
                    </tr>
                    {abbreviateRASteps(first?.steps ?? second!.steps).map(
                      (step, index) => (
                        <PipelineStep
                          key={index}
                          before={first?.counts[index]}
                          after={second?.counts[index]}
                          step={step}
                        />
                      ),
                    )}
                  </Fragment>
                ))}
              </>
            )}
          </tbody>
        </Table>
      ))}
      <Table>
        <tfoot>
          <tr key="spacing">
            <td colSpan={5} style={{ height: "1em" }}></td>
          </tr>
          <tr key="total">
            <ChevronCell />
            <NumberCell>{formatDecimal(totalBefore)}</NumberCell>
            <NumberCell>{formatDecimal(totalAfter)}</NumberCell>
            {renderDelta(totalDiff)}
            <NameCell>TOTAL</NameCell>
          </tr>
        </tfoot>
      </Table>
    </>
  );
}

interface PipelinePair {
  name: string;
  first: PipelineSummary | undefined;
  second: PipelineSummary | undefined;
}

function collatePipelines(
  before: Record<string, PipelineSummary>,
  after: Record<string, PipelineSummary>,
): PipelinePair[] {
  const result: PipelinePair[] = [];

  for (const [name, first] of Object.entries(before)) {
    const second = after[name];
    if (second == null) {
      result.push({ name, first, second: undefined });
    } else if (samePipeline(first.steps, second.steps)) {
      result.push({ name, first, second });
    } else {
      result.push({ name, first, second: undefined });
      result.push({ name, first: undefined, second });
    }
  }

  for (const [name, second] of Object.entries(after)) {
    if (before[name] == null) {
      result.push({ name, first: undefined, second });
    }
  }

  return result;
}

function samePipeline(a: string[], b: string[]) {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

// function hashPipeline(name: string, steps: string[]) {
//   return `${name}-${hashRA(steps)}`;
// }

// function hashRA(ra: string[]) {
//   return ra.join("\n");
// }
