/**
 * Types for messages exchanged during jsonrpc communication with the
 * the QL query server.
 */

import * as rpc from 'vscode-jsonrpc';
export enum QueryResultType {
  SUCCESS = 0,
  OTHER_ERROR = 1,
  OOM = 2,
  TIMEOUT = 3,
  CANCELLATION = 4,
}

export enum ResultKind {
  FLOAT = 0,
  INTEGER = 1,
  STRING = 2,
  BOOLEAN = 3,
  DATE = 4,
  ENTITY = 5,
}

export enum ResultType {
  METRIC = 0,
  DEFECT = 1,
}

export enum Severity {
  ERROR = 0,
  WARNING = 1,
}

export interface CheckQueryParams {
  compilationOptions?: CompilationOptions;
  queryToCheck?: QlProgram;
  target?: CompilationTarget;
}

export interface CheckQueryResult {
  fromCache: boolean;
  messages?: CompilationMessage[];
  resultPatterns?: ResultPattern[];
}

export interface CheckUpgradeResult {
  checkedUpgrades?: UpgradesDescription;
  upgradeError?: string;
}

export interface ClearCacheParams {
  db?: Database;
  dryRun: boolean;
}

export interface ClearCacheResult {
  deletionMessage?: string;
}

export interface CompilationMessage {
  message?: string;
  position?: Position;
  severity?: Severity;
}

export interface CompilationOptions {
  computeNoLocationUrls: boolean;
  failOnWarnings: boolean;
  fastCompilation: boolean;
  includeDilInQlo: boolean;
  localChecking: boolean;
  noComputeGetUrl: boolean;
  noComputeToString: boolean;
}

export interface CompilationTarget {
  query?: Query;
  quickEval?: QuickEval;
}

export interface CompileDilParams {
  compilationOptions?: DilCompilationOptions;
  extraOptions?: ExtraOptions;
  queryToRun?: DILQuery;
  resultPath?: string;
}

export interface CompileQueryParams {
  compilationOptions?: CompilationOptions;
  extraOptions?: ExtraOptions;
  queryToCheck?: QlProgram;
  resultPath?: string;
  target?: CompilationTarget;
}

export interface CompileUpgradeParams {
  upgrade?: UpgradeParams;
  upgradeTempDir?: string;
}

export interface CompileUpgradeResult {
  compiledUpgrades?: CompiledUpgrades;
  error?: string;
}

export interface CompiledUpgradeScript {
  description?: UpgradeDescription;
  newDbschemePath?: string;
  specs?: UpgradeAction[];
}

export interface CompiledUpgrades {
  initialSha?: string;
  newStatsPath?: string;
  scripts?: CompiledUpgradeScript[];
  targetSha?: string;
}

export interface DILQuery {
  dbschemePath?: string;
  dilPath?: string;
  dilSource?: string;
}

export interface Database {
  dbDir?: string;
  workingSet?: string;
}

export interface DeleteSpec {
  relationToDelete?: string;
}

export interface DilCompilationOptions {
  fastCompilation: boolean;
  includeDilInQlo: boolean;
}

export interface EvaluateQueriesParams {
  db?: Database;
  evaluateId: number;
  queries?: QueryToRun[];
  stopOnError: boolean;
  useSequenceHint: boolean;
}

export interface EvaluationComplete {

}

export interface EvaluationResult {
  evaluationTime: number;
  message?: string;
  queryId: number;
  resultType?: QueryResultType;
  runId: number;
}

export interface ExtraOptions {
  extraCompilationCache?: string;
  timeoutSecs: number;
}

export interface Position {
  column: number;
  endColumn: number;
  endLine: number;
  fileName?: string;
  line: number;
}

export interface ProblemResults {
  queryPath?: string;
  results?: ResultSet;
  type?: ResultType;
}

export interface ProgressMessage {
  id: number;
  maxStep: number;
  message?: string;
  step: number;
}

export interface QlFileSet {
  imports?: { [key: string]: string[]; };
  libraryPath?: string[];
  nodeNumbering?: { [key: string]: number; };
  qlCode?: { [key: string]: string; };
  queryFile?: string;
  resolvedDirImports?: { [key: string]: { [key: string]: string; }; };
}

export interface QlProgram {
  dbschemePath?: string;
  libraryPath?: string[];
  queryPath?: string;
  sourceContents?: QlFileSet;
}

export interface QloSpec {
  newRelation?: string;
  qloUri?: string;
}

export interface QueryToRun {
  allowUnknownTemplates: boolean;
  id: number;
  qlo?: string;
  resultsPath?: string;
  templateValues?: { [key: string]: TemplateSource; };
  timeoutSecs: number;
}

export interface Query {

}

export interface QuickEval {
  quickEvalPos?: Position;
}

export interface RelationValues {
  tuples?: Value[][];
}

export interface ResultColumn {
  kind?: ResultKind;
  name?: string;
}

export interface ResultPattern {
  columns?: ResultColumn[];
  name?: string;
}

export interface ResultSet {
  precedingQuery?: number;
  resultsFile?: string;
}

export interface RunUpgradeParams {
  db?: Database;
  timeoutSecs: number;
  toRun?: CompiledUpgrades;
}

export interface RunUpgradeResult {
  error?: string;
  finalSha?: string;
  resultType?: QueryResultType;
}

export interface TemplateSource {
  interpretedInput?: ProblemResults;
  values?: RelationValues;
}

export interface TrimCacheParams {
  db?: Database;
}

export interface UpgradeAction {
  deleted?: DeleteSpec;
  runQuery?: QloSpec;
}

export interface UpgradeDescription {
  compatibility?: string;
  description?: string;
  newSha?: string;
}

export interface UpgradeParams {
  additionalUpgrades?: string[];
  fromDbscheme?: string;
  toDbscheme?: string;
}

export interface UpgradesDescription {
  initialSha?: string;
  scripts?: UpgradeDescription[];
  targetSha?: string;
}

export interface Value {
  booleanValue?: boolean;
  dateValue?: string;
  doubleValue?: number;
  intValue?: number;
  stringValue?: string;
}

export interface WithProgressId<T> {
  body: T, progressId: number
}

export const checkQuery = new rpc.RequestType<WithProgressId<CheckQueryParams>, CheckQueryResult, void, void>('qlcompiler/checkQuery');

export const checkUpgrade = new rpc.RequestType<WithProgressId<UpgradeParams>, CheckUpgradeResult, void, void>('qlcompiler/checkUpgrade');

export const clearCache = new rpc.RequestType<WithProgressId<ClearCacheParams>, ClearCacheResult, void, void>('evaluation/clearCache');

export const compileDilQuery = new rpc.RequestType<WithProgressId<CompileDilParams>, CheckQueryResult, void, void>('qlcompiler/compileDilQuery');

export const compileQuery = new rpc.RequestType<WithProgressId<CompileQueryParams>, CheckQueryResult, void, void>('qlcompiler/compileQuery');

export const compileUpgrade = new rpc.RequestType<WithProgressId<CompileUpgradeParams>, CompileUpgradeResult, void, void>('qlcompiler/compileUpgrade');

export const completeQuery = new rpc.RequestType<EvaluationResult, Object, void, void>('evaluation/queryCompleted');

export const progress = new rpc.NotificationType<ProgressMessage, void>('semmle/progressUpdated');

export const runQueries = new rpc.RequestType<WithProgressId<EvaluateQueriesParams>, EvaluationComplete, void, void>('evaluation/runQueries');

export const runUpgrade = new rpc.RequestType<WithProgressId<RunUpgradeParams>, RunUpgradeResult, void, void>('evaluation/runUpgrade');

export const trimCache = new rpc.RequestType<WithProgressId<TrimCacheParams>, ClearCacheResult, void, void>('evaluation/trimCache');
