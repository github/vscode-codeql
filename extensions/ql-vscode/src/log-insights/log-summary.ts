export interface PipelineRun {
  raReference: string;
  counts: number[];
  duplicationPercentages: number[];
}

export interface Ra {
  [key: string]: string[];
}

export type EvaluationStrategy =
  | "COMPUTE_SIMPLE"
  | "COMPUTE_RECURSIVE"
  | "IN_LAYER"
  | "COMPUTED_EXTENSIONAL"
  | "EXTENSIONAL"
  | "SENTINEL_EMPTY"
  | "CACHACA"
  | "CACHE_HIT";

interface SummaryEventBase {
  evaluationStrategy: EvaluationStrategy;
  predicateName: string;
  raHash: string;
  appearsAs: { [key: string]: { [key: string]: number[] } };
  completionType?: string;
}

interface ResultEventBase extends SummaryEventBase {
  resultSize: number;
}

export interface ComputeSimple extends ResultEventBase {
  evaluationStrategy: "COMPUTE_SIMPLE";
  ra: Ra;
  pipelineRuns?: [PipelineRun];
  queryCausingWork?: string;
  dependencies: { [key: string]: string };
}

export interface ComputeRecursive extends ResultEventBase {
  evaluationStrategy: "COMPUTE_RECURSIVE";
  deltaSizes: number[];
  ra: Ra;
  pipelineRuns: PipelineRun[];
  queryCausingWork?: string;
  dependencies: { [key: string]: string };
  predicateIterationMillis: number[];
}

export interface InLayer extends ResultEventBase {
  evaluationStrategy: "IN_LAYER";
  deltaSizes: number[];
  ra: Ra;
  pipelineRuns: PipelineRun[];
  queryCausingWork?: string;
  mainHash: string;
  predicateIterationMillis: number[];
}

export interface ComputedExtensional extends ResultEventBase {
  evaluationStrategy: "COMPUTED_EXTENSIONAL";
  queryCausingWork?: string;
}

export interface NonComputedExtensional extends ResultEventBase {
  evaluationStrategy: "EXTENSIONAL";
  queryCausingWork?: string;
}

export interface SentinelEmpty extends SummaryEventBase {
  evaluationStrategy: "SENTINEL_EMPTY";
  sentinelRaHash: string;
}

export interface Cachaca extends ResultEventBase {
  evaluationStrategy: "CACHACA";
}

export interface CacheHit extends ResultEventBase {
  evaluationStrategy: "CACHE_HIT";
}

export type Extensional = ComputedExtensional | NonComputedExtensional;

export type SummaryEvent =
  | ComputeSimple
  | ComputeRecursive
  | InLayer
  | Extensional
  | SentinelEmpty
  | Cachaca
  | CacheHit;
