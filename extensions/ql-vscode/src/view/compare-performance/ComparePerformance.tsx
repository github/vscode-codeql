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
import { Codicon, ViewTitle } from "../common";
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
  name: string;
  raHash: string;
  tuples: number;
  evaluationCount: number;
  iterationCount: number;
  timeCost: number;
  pipelines: Record<string, PipelineSummary>;
}

class ComparisonDataset {
  /**
   * Predicates indexed by a key consisting of the name and its pipeline hash.
   * Unlike the RA hash, the pipeline hash only depends on the predicate's own pipeline.
   */
  public keyToIndex = new Map<string, number>();
  public raToIndex = new Map<string, number>();
  public nameToIndex = new Map<string, number>();
  public cacheHitIndices: Set<number>;
  public sentinelEmptyIndices: Set<number>;

  constructor(private data: PerformanceComparisonDataFromLog) {
    const { names, raHashes, pipelineSummaryList } = data;
    const { keyToIndex, raToIndex, nameToIndex } = this;
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const pipelineHash = getPipelineSummaryHash(pipelineSummaryList[i]);
      keyToIndex.set(`${name}@${pipelineHash}`, i);
      nameToIndex.set(name, i);
      raToIndex.set(raHashes[i], i);
    }
    this.cacheHitIndices = new Set(data.cacheHitIndices);
    this.sentinelEmptyIndices = new Set(data.sentinelEmptyIndices);
  }

  keys() {
    return Array.from(this.keyToIndex.keys());
  }

  getTupleCountInfo(key: string): Optional<PredicateInfo> {
    const { data, keyToIndex, cacheHitIndices, sentinelEmptyIndices } = this;
    const index = keyToIndex.get(key);
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
      name: data.names[index],
      raHash: data.raHashes[index],
      evaluationCount: data.evaluationCounts[index],
      iterationCount: data.iterationCounts[index],
      timeCost: data.timeCosts[index],
      tuples: tupleCost,
      pipelines: data.pipelineSummaryList[index],
    };
  }

  /**
   * Returns the RA hashes of all predicates that were evaluated in this data set, but not seen in `other`,
   * because in `other` the dependency upon these predicates was cut off by a cache hit.
   *
   * For example, suppose predicate `A` depends on `B`, which depends on `C`, and the
   * predicates were evaluated in the first log but not the second:
   * ```
   *                  first eval. log        second eval. log
   * predicate A      seen evaluation        seen cache hit
   *    |
   *    V
   * predicate B      seen evaluation        not seen
   *    |
   *    V
   * predicate C      seen evaluation        not seen
   * ```
   *
   * To ensure a meaningful comparison, we want to omit `predicate A` from the comparison view because of the cache hit.
   *
   * But predicates B and C did not have a recorded cache hit in the second log, because they were never scheduled for evaluation.
   * Given the dependency graph, the most likely explanation is that they would have been evaluated if `A` had not been a cache hit.
   * We therefore say that B and C are "shadowed" by the cache hit on A.
   *
   * The dependency graph is only visible in the first evaluation log, because `B` and `C` do not exist in the second log.
   * So to compute this, we use the dependency graph from one log together with the set of cache hits in the other log.
   */
  getPredicatesShadowedByCacheHit(other: ComparisonDataset) {
    const {
      data: { dependencyLists, raHashes, names },
      raToIndex,
    } = this;
    const cacheHits = new Set<string>();

    function visit(index: number, raHash: string) {
      if (cacheHits.has(raHash)) {
        return;
      }
      cacheHits.add(raHash);
      const dependencies = dependencyLists[index];
      for (const dep of dependencies) {
        const name = names[dep];
        if (!other.nameToIndex.has(name)) {
          visit(dep, raHashes[dep]);
        }
      }
    }

    for (const otherCacheHit of other.cacheHitIndices) {
      {
        // Look up by RA hash
        const raHash = other.data.raHashes[otherCacheHit];
        const ownIndex = raToIndex.get(raHash);
        if (ownIndex != null) {
          visit(ownIndex, raHash);
        }
      }
      {
        // Look up by name
        const name = other.data.names[otherCacheHit];
        const ownIndex = this.nameToIndex.get(name);
        if (ownIndex != null) {
          visit(ownIndex, raHashes[ownIndex]);
        }
      }
    }

    return cacheHits;
  }
}

function renderOptionalValue(x: Optional<number>, unit: string | undefined) {
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

function renderPredicateMetric(
  x: Optional<PredicateInfo>,
  metric: Metric,
  isPerEvaluation: boolean,
) {
  return renderOptionalValue(
    metricGetOptional(metric, x, isPerEvaluation),
    metric.unit,
  );
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

interface HeaderRowProps {
  hasBefore?: boolean;
  hasAfter?: boolean;
  comparison: boolean;
  title: React.ReactNode;
}

function HeaderRow(props: HeaderRowProps) {
  const { comparison, hasBefore, hasAfter, title } = props;
  return (
    <HeaderTR>
      <ChevronCell />
      {comparison ? (
        <>
          <NumberHeader>{hasBefore ? "Before" : ""}</NumberHeader>
          <NumberHeader>{hasAfter ? "After" : ""}</NumberHeader>
          <NumberHeader>{hasBefore && hasAfter ? "Delta" : ""}</NumberHeader>
        </>
      ) : (
        <NumberHeader>Value</NumberHeader>
      )}
      <NameHeader>{title}</NameHeader>
    </HeaderTR>
  );
}

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
      <HeaderRow
        hasBefore={hasBefore}
        hasAfter={hasAfter}
        title="Stats"
        comparison={comparison}
      />
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
  key: string;
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
    title: "Tuple count",
    get: (info) => info.tuples,
  },
  time: {
    title: "Time spent",
    get: (info) => info.timeCost,
    unit: "ms",
  },
  evaluations: {
    title: "Evaluations",
    get: (info) => info.evaluationCount,
  },
  iterationsTotal: {
    title: "Iterations",
    get: (info) => info.iterationCount,
  },
};

function metricGetOptional(
  metric: Metric,
  info: Optional<PredicateInfo>,
  isPerEvaluation: boolean,
): Optional<number> {
  if (!isPresent(info)) {
    return info;
  }
  const value = metric.get(info);
  return isPerEvaluation ? (value / info.evaluationCount) | 0 : value;
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
function getNameFingerprint(name: string, renamings: Renaming[]) {
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

  const [hideCacheHits, setHideCacheHits] = useState(true);

  const [sortOrder, setSortOrder] = useState<"delta" | "absDelta">("absDelta");

  const [metric, setMetric] = useState<Metric>(metrics.tuples);

  const [isPerEvaluation, setPerEvaluation] = useState(false);

  const keySet = useMemo(() => union(from.keys(), to.keys()), [from, to]);

  const hasCacheHitMismatch = useRef(false);

  const shadowedCacheHitsFrom = useMemo(
    () =>
      hideCacheHits ? from.getPredicatesShadowedByCacheHit(to) : new Set(),
    [from, to, hideCacheHits],
  );
  const shadowedCacheHitsTo = useMemo(
    () =>
      hideCacheHits ? to.getPredicatesShadowedByCacheHit(from) : new Set(),
    [from, to, hideCacheHits],
  );

  const rows: Row[] = useMemo(() => {
    hasCacheHitMismatch.current = false;
    return Array.from(keySet)
      .map((key) => {
        const before = from.getTupleCountInfo(key);
        const after = to.getTupleCountInfo(key);
        const beforeValue = metricGetOptional(metric, before, isPerEvaluation);
        const afterValue = metricGetOptional(metric, after, isPerEvaluation);
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
        if (
          (isPresent(before) &&
            !isPresent(after) &&
            shadowedCacheHitsFrom.has(before.raHash)) ||
          (isPresent(after) &&
            !isPresent(before) &&
            shadowedCacheHitsTo.has(after.raHash))
        ) {
          return undefined!;
        }
        const diff =
          (isPresent(afterValue) ? afterValue : 0) -
          (isPresent(beforeValue) ? beforeValue : 0);
        const name = isPresent(before)
          ? before.name
          : isPresent(after)
            ? after.name
            : key;
        return { key, name, before, after, diff } satisfies Row;
      })
      .filter((x) => !!x)
      .sort(getSortOrder(sortOrder));
  }, [
    keySet,
    from,
    to,
    metric,
    hideCacheHits,
    sortOrder,
    isPerEvaluation,
    shadowedCacheHitsFrom,
    shadowedCacheHitsTo,
  ]);

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
          .map((row) => metricGetOptional(metric, row.before, isPerEvaluation))
          .reduce(addOptionals);
        const after = rows
          .map((row) => metricGetOptional(metric, row.after, isPerEvaluation))
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
  }, [rows, metric, sortOrder, deferredRenamings, isPerEvaluation]);

  const rowGroupNames = useMemo(
    () => abbreviateRANames(rowGroups.map((group) => group.name)),
    [rowGroups],
  );

  return (
    <>
      <ViewTitle>Performance comparison</ViewTitle>
      {comparison && hasCacheHitMismatch.current && (
        <label>
          <input
            type="checkbox"
            checked={hideCacheHits}
            onChange={() => setHideCacheHits(!hideCacheHits)}
          />
          Hide differences due to cache hits
        </label>
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
      <Dropdown
        onChange={(e: ChangeEvent<HTMLSelectElement>) =>
          setPerEvaluation(e.target.value === "per-evaluation")
        }
      >
        <option value="total">Overall</option>
        <option value="per-evaluation">Per evaluation</option>
      </Dropdown>{" "}
      {comparison && (
        <>
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
        </>
      )}
      <Table>
        <thead>
          <HeaderRow comparison={comparison} title="Predicate" />
        </thead>
        <tbody>
          <tr key="total">
            <ChevronCell />
            {comparison && renderOptionalValue(totalBefore, metric.unit)}
            {renderOptionalValue(totalAfter, metric.unit)}
            {comparison && renderDelta(totalDiff, metric.unit)}
            <NameCell>
              <strong>TOTAL</strong>
            </NameCell>
          </tr>
          <tr key="spacing">
            <td colSpan={5} style={{ height: "1em" }}></td>
          </tr>
        </tbody>
      </Table>
      <PredicateTable
        rowGroups={rowGroups}
        rowGroupNames={rowGroupNames}
        comparison={comparison}
        metric={metric}
        isPerEvaluation={isPerEvaluation}
      />
    </>
  );
}

interface PredicateTableProps {
  rowGroups: RowGroup[];
  rowGroupNames: React.ReactNode[];
  comparison: boolean;
  metric: Metric;
  isPerEvaluation: boolean;
}

function PredicateTableRaw(props: PredicateTableProps) {
  const { comparison, metric, rowGroupNames, rowGroups, isPerEvaluation } =
    props;
  return rowGroups.map((rowGroup, rowGroupIndex) => (
    <PredicateRowGroup
      key={rowGroupIndex}
      renderedName={rowGroupNames[rowGroupIndex]}
      rowGroup={rowGroup}
      comparison={comparison}
      metric={metric}
      isPerEvaluation={isPerEvaluation}
    />
  ));
}

const PredicateTable = memo(PredicateTableRaw);

interface PredicateRowGroupProps {
  renderedName: React.ReactNode;
  rowGroup: RowGroup;
  comparison: boolean;
  metric: Metric;
  isPerEvaluation: boolean;
}

function PredicateRowGroup(props: PredicateRowGroupProps) {
  const { renderedName, rowGroup, comparison, metric, isPerEvaluation } = props;
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
          {comparison && renderOptionalValue(rowGroup.before, metric.unit)}
          {renderOptionalValue(rowGroup.after, metric.unit)}
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
                  isPerEvaluation={isPerEvaluation}
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
  isPerEvaluation: boolean;
}

function PredicateRow(props: PredicateRowProps) {
  const [isExpanded, setExpanded] = useState(false);
  const { renderedName, row, comparison, metric, isPerEvaluation } = props;
  const evaluationFactorBefore =
    isPerEvaluation && isPresent(row.before) ? row.before.evaluationCount : 1;
  const evaluationFactorAfter =
    isPerEvaluation && isPresent(row.after) ? row.after.evaluationCount : 1;
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
          {comparison &&
            renderPredicateMetric(row.before, metric, isPerEvaluation)}
          {renderPredicateMetric(row.after, metric, isPerEvaluation)}
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
                <HeaderRow
                  hasBefore={first != null}
                  hasAfter={second != null}
                  comparison={comparison}
                  title={
                    <>
                      Tuple counts for &apos;{name}&apos; pipeline
                      {comparison &&
                        (first == null
                          ? " (after)"
                          : second == null
                            ? " (before)"
                            : "")}
                    </>
                  }
                />
                {abbreviateRASteps(first?.steps ?? second?.steps ?? []).map(
                  (step, index) => (
                    <PipelineStep
                      key={index}
                      before={
                        first &&
                        (first.counts[index] / evaluationFactorBefore) | 0
                      }
                      after={
                        second &&
                        (second.counts[index] / evaluationFactorAfter) | 0
                      }
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

function getPipelineSummaryHash(pipelines: Record<string, PipelineSummary>) {
  // Note: we can't import "crypto" here because it is not available in the browser,
  // so we just concatenate the hashes of the individual pipelines.
  const keys = Object.keys(pipelines).sort();
  let result = "";
  for (const key of keys) {
    result += `${pipelines[key].hash};`;
  }
  return result;
}
