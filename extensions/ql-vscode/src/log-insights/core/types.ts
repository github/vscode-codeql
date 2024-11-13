export type PipelineRun = {
  raReference: string;
  counts: number[];
  duplicationPercentages: number[];
};

type Ra = {
  [key: string]: string[];
};

export type ComputeSimple = {
  predicateName: string;
  evaluationStrategy: "COMPUTE_SIMPLE";
  resultSize?: number;
  completionType?: string;
  ra: Ra;
  millis?: number;
  pipelineRuns?: [PipelineRun];
  queryCausingWork?: string;
  raHash: string;
  dependencies: { [key: string]: string };
  appearsAs: { [key: string]: { [key: string]: number[] } };
  isCached?: boolean;
};

export type ComputeRecursive = {
  predicateName: string;
  evaluationStrategy: "COMPUTE_RECURSIVE";
  deltaSizes: number[];
  resultSize?: number;
  completionType?: string;
  ra: Ra;
  millis?: number;
  pipelineRuns: PipelineRun[];
  queryCausingWork?: string;
  raHash: string;
  dependencies: { [key: string]: string };
  appearsAs: { [key: string]: { [key: string]: number[] } };
  predicateIterationMillis: number[];
  isCached?: boolean;
};

export type InLayer = {
  predicateName: string;
  evaluationStrategy: "IN_LAYER";
  deltaSizes: number[];
  resultSize?: number;
  completionType?: string;
  ra: Ra;
  pipelineRuns: PipelineRun[];
  queryCausingWork?: string;
  appearsAs: { [key: string]: { [key: string]: number[] } };
  raHash: string;
  mainHash: string;
  predicateIterationMillis: number[];
  isCached?: boolean;
};

type ComputedExtensional = {
  predicateName: string;
  evaluationStrategy: "COMPUTED_EXTENSIONAL";
  resultSize?: number;
  completionType?: string;
  queryCausingWork?: string;
  raHash: string;
  appearsAs: { [key: string]: { [key: string]: number[] } };
  isCached?: boolean;
};

type NonComputedExtensional = {
  predicateName: string;
  evaluationStrategy: "EXTENSIONAL";
  resultSize?: number;
  completionType?: string;
  queryCausingWork?: string;
  appearsAs: { [key: string]: { [key: string]: number[] } };
  raHash: string;
  isCached?: boolean;
};

type SentinelEmpty = {
  predicateName: string;
  evaluationStrategy: "SENTINEL_EMPTY";
  completionType?: string;
  appearsAs: { [key: string]: { [key: string]: number[] } };
  raHash: string;
  sentinelRaHash: string;
  isCached?: boolean;
};

type Cachaca = {
  predicateName: string;
  evaluationStrategy: "CACHACA";
  appearsAs: { [key: string]: { [key: string]: number[] } };
  resultSize?: number;
  completionType?: string;
  raHash: string;
  isCached?: boolean;
};

type CacheHit = {
  raHash: string;
  predicateName: string;
  appearsAs: { [key: string]: { [key: string]: number[] } };
  evaluationStrategy: "CACHE_HIT";
  resultSize?: number;
  completionType?: string;
  isCached?: boolean;
};

type Extensional = ComputedExtensional | NonComputedExtensional;

export type PipelineEvent =
  | ComputeSimple
  | ComputeRecursive
  | InLayer
  | Extensional
  | SentinelEmpty
  | Cachaca
  | CacheHit;

export type PredicateTiming = {
  predicate: string;
  millis: number;
  maxIterationMillis?: [number, number];
};

export type Timing = {
  millis: number;
  maxIterationMillis?: [number, number];
};

export type CachedPredicateList = Array<{ raHash: string; predName: string }>;
export type StageInfo = {
  millis: number;
  lastRaHash: string;
  lastPredName: string;
  cachedPredicateList: CachedPredicateList;
};
