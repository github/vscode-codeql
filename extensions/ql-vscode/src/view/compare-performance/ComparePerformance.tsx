import type { ChangeEvent } from "react";
import {
  Fragment,
  memo,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { abbreviateRANames, abbreviateRASteps } from "./RAPrettyPrinter";
import { Renaming, RenamingInput } from "./RenamingInput";

const enum AbsentReason {
  NotSeen = "NotSeen",
  CacheHit = "CacheHit",
  Sentinel = "Sentinel",
}

type Optional<T> = AbsentReason | T;

function isPresent<T>(x: Optional<T>): x is T {
  return typeof x !== "string";
}

interface PredicateInfo {
  tuples: number;
  evaluationCount: number;
  iterationCount: number;
  timeCost: number;
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

  getTupleCountInfo(name: string): Optional<PredicateInfo> {
    const { data, nameToIndex, cacheHitIndices, sentinelEmptyIndices } = this;
    const index = nameToIndex.get(name);
    if (index == null) {
      return AbsentReason.NotSeen;
    }
    const tupleCost = data.tupleCosts[index];
    if (tupleCost === 0) {
      if (sentinelEmptyIndices.has(index)) {
        return AbsentReason.Sentinel;
      } else if (cacheHitIndices.has(index)) {
        return AbsentReason.CacheHit;
      }
    }
    return {
      evaluationCount: data.evaluationCounts[index],
      iterationCount: data.iterationCounts[index],
      timeCost: data.timeCosts[index],
      tuples: tupleCost,
      pipelines: data.pipelineSummaryList[index],
    };
  }
}

function renderOptionalValue(x: Optional<number>, unit?: string) {
  switch (x) {
    case AbsentReason.NotSeen:
      return <AbsentNumberCell>n/a</AbsentNumberCell>;
    case AbsentReason.CacheHit:
      return <AbsentNumberCell>cache hit</AbsentNumberCell>;
    case AbsentReason.Sentinel:
      return <AbsentNumberCell>sentinel empty</AbsentNumberCell>;
    default:
      return (
        <NumberCell>
          {formatDecimal(x)}
          {renderUnit(unit)}
        </NumberCell>
      );
  }
}

function renderPredicateMetric(x: Optional<PredicateInfo>, metric: Metric) {
  return renderOptionalValue(metricGetOptional(metric, x), metric.unit);
}

function renderDelta(x: number, unit?: string) {
  const sign = x > 0 ? "+" : "";
  return (
    <NumberCell className={x > 0 ? "bad-value" : x < 0 ? "good-value" : ""}>
      {sign}
      {formatDecimal(x)}
      {renderUnit(unit)}
    </NumberCell>
  );
}

function renderUnit(unit: string | undefined) {
  return unit == null ? "" : ` ${unit}`;
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

  &.bad-value {
    color: var(--vscode-problemsErrorIcon-foreground);
    tr.expanded & {
      color: inherit;
    }
  }
  &.good-value {
    color: var(--vscode-problemsInfoIcon-foreground);
    tr.expanded & {
      color: inherit;
    }
  }
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
  word-break: break-all;
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

const Dropdown = styled.select``;

interface PipelineStepProps {
  before: number | undefined;
  after: number | undefined;
  comparison: boolean;
  step: React.ReactNode;
}

/**
 * Row with details of a pipeline step, or one of the high-level stats appearing above the pipelines (evaluation/iteration counts).
 */
function PipelineStep(props: PipelineStepProps) {
  let { before, after, comparison, step } = props;
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
      {comparison && (
        <NumberCell>{before != null ? formatDecimal(before) : ""}</NumberCell>
      )}
      <NumberCell>{after != null ? formatDecimal(after) : ""}</NumberCell>
      {comparison && (delta != null ? renderDelta(delta) : <td></td>)}
      <NameCell>{step}</NameCell>
    </PipelineStepTR>
  );
}

const HeaderTR = styled.tr`
  background-color: var(--vscode-sideBar-background);
`;

interface HighLevelStatsProps {
  before: Optional<PredicateInfo>;
  after: Optional<PredicateInfo>;
  comparison: boolean;
}

function HighLevelStats(props: HighLevelStatsProps) {
  const { before, after, comparison } = props;
  const hasBefore = isPresent(before);
  const hasAfter = isPresent(after);
  const showEvaluationCount =
    (hasBefore && before.evaluationCount > 1) ||
    (hasAfter && after.evaluationCount > 1);
  return (
    <>
      <HeaderTR>
        <ChevronCell></ChevronCell>
        {comparison && <NumberHeader>{hasBefore ? "Before" : ""}</NumberHeader>}
        <NumberHeader>{hasAfter ? "After" : ""}</NumberHeader>
        {comparison && (
          <NumberHeader>{hasBefore && hasAfter ? "Delta" : ""}</NumberHeader>
        )}
        <NameHeader>Stats</NameHeader>
      </HeaderTR>
      {showEvaluationCount && (
        <PipelineStep
          before={hasBefore ? before.evaluationCount : undefined}
          after={hasAfter ? after.evaluationCount : undefined}
          comparison={comparison}
          step="Number of evaluations"
        />
      )}
      <PipelineStep
        before={
          hasBefore ? before.iterationCount / before.evaluationCount : undefined
        }
        after={
          hasAfter ? after.iterationCount / after.evaluationCount : undefined
        }
        comparison={comparison}
        step={
          showEvaluationCount
            ? "Number of iterations per evaluation"
            : "Number of iterations"
        }
      />
    </>
  );
}

interface Row {
  name: string;
  before: Optional<PredicateInfo>;
  after: Optional<PredicateInfo>;
  diff: number;
}

/**
 * A set of predicates that have been grouped together because their names have the same fingerprint.
 */
interface RowGroup {
  name: string;
  rows: Row[];
  before: Optional<number>;
  after: Optional<number>;
  diff: number;
}

function getSortOrder(sortOrder: "delta" | "absDelta") {
  if (sortOrder === "absDelta") {
    return orderBy((row: { diff: number }) => -Math.abs(row.diff));
  }
  return orderBy((row: { diff: number }) => row.diff);
}

interface Metric {
  title: string;
  get(info: PredicateInfo): number;
  unit?: string;
}

const metrics: Record<string, Metric> = {
  tuples: {
    title: "Tuples in pipeline",
    get: (info) => info.tuples,
  },
  time: {
    title: "Time spent (milliseconds)",
    get: (info) => info.timeCost,
    unit: "ms",
  },
  evaluations: {
    title: "Evaluations",
    get: (info) => info.evaluationCount,
  },
  iterations: {
    title: "Iterations (per evaluation)",
    get: (info) =>
      info.evaluationCount === 0
        ? 0
        : info.iterationCount / info.evaluationCount,
  },
  iterationsTotal: {
    title: "Iterations (total)",
    get: (info) => info.iterationCount,
  },
};

function metricGetOptional(
  metric: Metric,
  value: Optional<PredicateInfo>,
): Optional<number> {
  return isPresent(value) ? metric.get(value) : value;
}

function addOptionals(a: Optional<number>, b: Optional<number>) {
  if (isPresent(a) && isPresent(b)) {
    return a + b;
  }
  if (isPresent(a)) {
    return a;
  }
  if (isPresent(b)) {
    return b;
  }
  if (a === b) {
    return a; // If absent for the same reason, preserve that reason
  }
  return 0; // Otherwise collapse to zero
}

/**
 * Returns a "fingerprint" from the given name, which is used to group together similar names.
 */
export function getNameFingerprint(name: string, renamings: Renaming[]) {
  for (const { patternRegexp, replacement } of renamings) {
    if (patternRegexp != null) {
      name = name.replace(patternRegexp, replacement);
    }
  }
  return name;
}

function Chevron({ expanded }: { expanded: boolean }) {
  return <Codicon name={expanded ? "chevron-down" : "chevron-right"} />;
}

function union<T>(a: Set<T> | T[], b: Set<T> | T[]) {
  const result = new Set(a);
  for (const x of b) {
    result.add(x);
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

  if (!data) {
    return <div>Loading performance comparison...</div>;
  }

  return <ComparePerformanceWithData data={data} />;
}

function ComparePerformanceWithData(props: {
  data: SetPerformanceComparisonQueries;
}) {
  const { data } = props;

  const { from, to } = useMemo(
    () => ({
      from: new ComparisonDataset(data.from),
      to: new ComparisonDataset(data.to),
    }),
    [data],
  );

  const comparison = data?.comparison;

  const [hideCacheHits, setHideCacheHits] = useState(false);

  const [sortOrder, setSortOrder] = useState<"delta" | "absDelta">("absDelta");

  const [metric, setMetric] = useState<Metric>(metrics.tuples);

  const nameSet = useMemo(
    () => union(from.data.names, to.data.names),
    [from, to],
  );

  const hasCacheHitMismatch = useRef(false);

  const rows: Row[] = useMemo(() => {
    hasCacheHitMismatch.current = false;
    return Array.from(nameSet)
      .map((name) => {
        const before = from.getTupleCountInfo(name);
        const after = to.getTupleCountInfo(name);
        const beforeValue = metricGetOptional(metric, before);
        const afterValue = metricGetOptional(metric, after);
        if (beforeValue === afterValue) {
          return undefined!;
        }
        if (
          before === AbsentReason.CacheHit ||
          after === AbsentReason.CacheHit
        ) {
          hasCacheHitMismatch.current = true;
          if (hideCacheHits) {
            return undefined!;
          }
        }
        const diff =
          (isPresent(afterValue) ? afterValue : 0) -
          (isPresent(beforeValue) ? beforeValue : 0);
        return { name, before, after, diff } satisfies Row;
      })
      .filter((x) => !!x)
      .sort(getSortOrder(sortOrder));
  }, [nameSet, from, to, metric, hideCacheHits, sortOrder]);

  const { totalBefore, totalAfter, totalDiff } = useMemo(() => {
    let totalBefore = 0;
    let totalAfter = 0;
    let totalDiff = 0;
    for (const row of rows) {
      totalBefore += isPresent(row.before) ? metric.get(row.before) : 0;
      totalAfter += isPresent(row.after) ? metric.get(row.after) : 0;
      totalDiff += row.diff;
    }
    return { totalBefore, totalAfter, totalDiff };
  }, [rows, metric]);

  const [renamings, setRenamings] = useState<Renaming[]>(() => [
    new Renaming("#[0-9a-f]{8}(?![0-9a-f])", "#"),
  ]);

  // Use deferred value to avoid expensive re-rendering for every keypress in the renaming editor
  const deferredRenamings = useDeferredValue(renamings);

  const rowGroups = useMemo(() => {
    const groupedRows = new Map<string, Row[]>();
    for (const row of rows) {
      const fingerprint = getNameFingerprint(row.name, deferredRenamings);
      const rows = groupedRows.get(fingerprint);
      if (rows) {
        rows.push(row);
      } else {
        groupedRows.set(fingerprint, [row]);
      }
    }
    return Array.from(groupedRows.entries())
      .map(([fingerprint, rows]) => {
        const before = rows
          .map((row) => metricGetOptional(metric, row.before))
          .reduce(addOptionals);
        const after = rows
          .map((row) => metricGetOptional(metric, row.after))
          .reduce(addOptionals);
        return {
          name: rows.length === 1 ? rows[0].name : fingerprint,
          before,
          after,
          diff:
            (isPresent(after) ? after : 0) - (isPresent(before) ? before : 0),
          rows,
        } satisfies RowGroup;
      })
      .sort(getSortOrder(sortOrder));
  }, [rows, metric, sortOrder, deferredRenamings]);

  const rowGroupNames = useMemo(
    () => abbreviateRANames(rowGroups.map((group) => group.name)),
    [rowGroups],
  );

  return (
    <>
      <ViewTitle>Performance comparison</ViewTitle>
      {hasCacheHitMismatch.current && (
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
      <RenamingInput renamings={renamings} setRenamings={setRenamings} />
      Compare{" "}
      <Dropdown
        onChange={(e: ChangeEvent<HTMLSelectElement>) =>
          setMetric(metrics[e.target.value])
        }
      >
        {Object.entries(metrics).map(([key, value]) => (
          <option key={key} value={key}>
            {value.title}
          </option>
        ))}
      </Dropdown>{" "}
      sorted by{" "}
      <Dropdown
        onChange={(e: ChangeEvent<HTMLSelectElement>) =>
          setSortOrder(e.target.value as "delta" | "absDelta")
        }
        value={sortOrder}
      >
        <option value="delta">Delta</option>
        <option value="absDelta">Absolute delta</option>
      </Dropdown>
      <Table>
        <thead>
          <HeaderTR>
            <ChevronCell />
            {comparison && <NumberHeader>Before</NumberHeader>}
            <NumberHeader>{comparison ? "After" : "Value"}</NumberHeader>
            {comparison && <NumberHeader>Delta</NumberHeader>}
            <NameHeader>Predicate</NameHeader>
          </HeaderTR>
        </thead>
      </Table>
      <PredicateTable
        rowGroups={rowGroups}
        rowGroupNames={rowGroupNames}
        comparison={comparison}
        metric={metric}
      />
      <Table>
        <tfoot>
          <tr key="spacing">
            <td colSpan={5} style={{ height: "1em" }}></td>
          </tr>
          <tr key="total">
            <ChevronCell />
            {comparison && (
              <NumberCell>{formatDecimal(totalBefore)}</NumberCell>
            )}
            <NumberCell>{formatDecimal(totalAfter)}</NumberCell>
            {comparison && renderDelta(totalDiff)}
            <NameCell>TOTAL</NameCell>
          </tr>
        </tfoot>
      </Table>
    </>
  );
}

interface PredicateTableProps {
  rowGroups: RowGroup[];
  rowGroupNames: React.ReactNode[];
  comparison: boolean;
  metric: Metric;
}

function PredicateTableRaw(props: PredicateTableProps) {
  const { comparison, metric, rowGroupNames, rowGroups } = props;
  return rowGroups.map((rowGroup, rowGroupIndex) => (
    <PredicateRowGroup
      key={rowGroupIndex}
      renderedName={rowGroupNames[rowGroupIndex]}
      rowGroup={rowGroup}
      comparison={comparison}
      metric={metric}
    />
  ));
}

const PredicateTable = memo(PredicateTableRaw);

interface PredicateRowGroupProps {
  renderedName: React.ReactNode;
  rowGroup: RowGroup;
  comparison: boolean;
  metric: Metric;
}

function PredicateRowGroup(props: PredicateRowGroupProps) {
  const { renderedName, rowGroup, comparison, metric } = props;
  const [isExpanded, setExpanded] = useState(false);
  const rowNames = useMemo(
    () => abbreviateRANames(rowGroup.rows.map((row) => row.name)),
    [rowGroup],
  );
  if (rowGroup.rows.length === 1) {
    return <PredicateRow row={rowGroup.rows[0]} {...props} />;
  }
  return (
    <Table className={isExpanded ? "expanded" : ""}>
      <tbody>
        <PredicateTR
          className={isExpanded ? "expanded" : ""}
          key={"main"}
          onClick={() => setExpanded(!isExpanded)}
        >
          <ChevronCell>
            <Chevron expanded={isExpanded} />
          </ChevronCell>
          {comparison && renderOptionalValue(rowGroup.before)}
          {renderOptionalValue(rowGroup.after)}
          {comparison && renderDelta(rowGroup.diff, metric.unit)}
          <NameCell>
            {renderedName} ({rowGroup.rows.length} predicates)
          </NameCell>
        </PredicateTR>
        {isExpanded &&
          rowGroup.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              <td colSpan={5}>
                <PredicateRow
                  renderedName={rowNames[rowIndex]}
                  row={row}
                  comparison={comparison}
                  metric={metric}
                />
              </td>
            </tr>
          ))}
      </tbody>
    </Table>
  );
}

interface PredicateRowProps {
  renderedName: React.ReactNode;
  row: Row;
  comparison: boolean;
  metric: Metric;
}

function PredicateRow(props: PredicateRowProps) {
  const [isExpanded, setExpanded] = useState(false);
  const { renderedName, row, comparison, metric } = props;
  return (
    <Table className={isExpanded ? "expanded" : ""}>
      <tbody>
        <PredicateTR
          className={isExpanded ? "expanded" : ""}
          key={"main"}
          onClick={() => setExpanded(!isExpanded)}
        >
          <ChevronCell>
            <Chevron expanded={isExpanded} />
          </ChevronCell>
          {comparison && renderPredicateMetric(row.before, metric)}
          {renderPredicateMetric(row.after, metric)}
          {comparison && renderDelta(row.diff, metric.unit)}
          <NameCell>{renderedName}</NameCell>
        </PredicateTR>
        {isExpanded && (
          <>
            <HighLevelStats
              before={row.before}
              after={row.after}
              comparison={comparison}
            />
            {collatePipelines(
              isPresent(row.before) ? row.before.pipelines : {},
              isPresent(row.after) ? row.after.pipelines : {},
            ).map(({ name, first, second }, pipelineIndex) => (
              <Fragment key={pipelineIndex}>
                <HeaderTR>
                  <td></td>
                  {comparison && (
                    <NumberHeader>{first != null && "Before"}</NumberHeader>
                  )}
                  <NumberHeader>{second != null && "After"}</NumberHeader>
                  {comparison && (
                    <NumberHeader>
                      {first != null && second != null && "Delta"}
                    </NumberHeader>
                  )}
                  <NameHeader>
                    Tuple counts for &apos;{name}&apos; pipeline
                    {comparison &&
                      (first == null
                        ? " (after)"
                        : second == null
                          ? " (before)"
                          : "")}
                  </NameHeader>
                </HeaderTR>
                {abbreviateRASteps(first?.steps ?? second!.steps).map(
                  (step, index) => (
                    <PipelineStep
                      key={index}
                      before={first?.counts[index]}
                      after={second?.counts[index]}
                      comparison={comparison}
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
