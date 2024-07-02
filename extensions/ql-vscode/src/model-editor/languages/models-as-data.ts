import type { EndpointType, MethodArgument, MethodDefinition } from "../method";
import type {
  ModeledMethod,
  NeutralModeledMethod,
  SinkModeledMethod,
  SourceModeledMethod,
  SummaryModeledMethod,
  TypeModeledMethod,
} from "../modeled-method";
import type { DataTuple, ModelExtension } from "../model-extension-file";
import type { Mode } from "../shared/mode";
import type { QueryConstraints } from "../../local-queries/query-constraints";
import type {
  DecodedBqrs,
  DecodedBqrsChunk,
} from "../../common/bqrs-cli-types";
import type { BaseLogger } from "../../common/logging";
import type { AccessPathSuggestionRow } from "../suggestions";

// This is a subset of the model config that doesn't import the vscode module.
// It only includes settings that are actually used.
export type ModelConfig = {
  flowGeneration: boolean;
};

/**
 * This function creates a new model config object from the given model config object.
 * The new model config object is a deep copy of the given model config object.
 *
 * @param modelConfig The model config object to create a new model config object from.
 *                    In most cases, this is a `ModelConfigListener`.
 */
export function createModelConfig(modelConfig: ModelConfig): ModelConfig {
  return {
    flowGeneration: modelConfig.flowGeneration,
  };
}

export const defaultModelConfig: ModelConfig = {
  flowGeneration: false,
};

type GenerateMethodDefinition<T> = (method: T) => DataTuple[];
type ReadModeledMethod = (row: DataTuple[]) => ModeledMethod;

type IsHiddenContext = {
  method: MethodDefinition;
  config: ModelConfig;
};

export type ModelsAsDataLanguagePredicate<T> = {
  extensiblePredicate: string;
  supportedKinds?: string[];
  /**
   * The endpoint types that this predicate supports. If not specified, the predicate supports all
   * endpoint types.
   */
  supportedEndpointTypes?: EndpointType[];
  generateMethodDefinition: GenerateMethodDefinition<T>;
  readModeledMethod: ReadModeledMethod;

  /**
   * Controls whether this predicate is hidden for a certain method. This only applies to the UI.
   * If not specified, the predicate is visible for all methods.
   *
   * @param method The method to check if the predicate is hidden for.
   */
  isHidden?: (context: IsHiddenContext) => boolean;
};

export type GenerationContext = {
  mode: Mode;
  config: ModelConfig;
};

type ParseGenerationResults = (
  // The path to the query that generated the results.
  queryPath: string,
  // The results of the query.
  bqrs: DecodedBqrs,
  // The language-specific predicate that was used to generate the results. This is passed to allow
  // sharing of code between different languages.
  modelsAsDataLanguage: ModelsAsDataLanguage,
  // The logger to use for logging.
  logger: BaseLogger,
  // Context about this invocation of the generation.
  context: GenerationContext,
) => ModeledMethod[];

type ModelsAsDataLanguageModelGeneration = {
  queryConstraints: (mode: Mode) => QueryConstraints;
  filterQueries?: (queryPath: string) => boolean;
  parseResults: ParseGenerationResults;
};

type ParseResultsToYaml = (
  // The path to the query that generated the results.
  queryPath: string,
  // The results of the query.
  bqrs: DecodedBqrs,
  // The language-specific predicate that was used to generate the results. This is passed to allow
  // sharing of code between different languages.
  modelsAsDataLanguage: ModelsAsDataLanguage,
  // The logger to use for logging.
  logger: BaseLogger,
) => ModelExtension[];

export enum AutoModelGenerationType {
  /**
   * Auto model generation is disabled and will not be run.
   */
  Disabled = "disabled",
  /**
   * The models are generated to a separate file (suffixed with .model.generated.yml).
   */
  SeparateFile = "separateFile",
  /**
   * The models are added as a model in the model editor, but are not automatically saved.
   * The user can view them and choose to save them.
   */
  Models = "models",
}

type ModelsAsDataLanguageAutoModelGeneration = {
  queryConstraints: (mode: Mode) => QueryConstraints;
  filterQueries?: (queryPath: string) => boolean;
  /**
   * This function is only used when type is `separateFile`.
   */
  parseResultsToYaml: ParseResultsToYaml;
  /**
   * This function is only used when type is `models`.
   */
  parseResults: ParseGenerationResults;
  type: (context: GenerationContext) => AutoModelGenerationType;
};

type ModelsAsDataLanguageAccessPathSuggestions = {
  queryConstraints: (mode: Mode) => QueryConstraints;
  parseResults: (
    // The results of a single predicate of the query.
    bqrs: DecodedBqrsChunk,
    // The language-specific predicate that was used to generate the results. This is passed to allow
    // sharing of code between different languages.
    modelsAsDataLanguage: ModelsAsDataLanguage,
    // The logger to use for logging.
    logger: BaseLogger,
  ) => AccessPathSuggestionRow[];
};

export type ModelsAsDataLanguagePredicates = {
  source?: ModelsAsDataLanguagePredicate<SourceModeledMethod>;
  sink?: ModelsAsDataLanguagePredicate<SinkModeledMethod>;
  summary?: ModelsAsDataLanguagePredicate<SummaryModeledMethod>;
  neutral?: ModelsAsDataLanguagePredicate<NeutralModeledMethod>;
  type?: ModelsAsDataLanguagePredicate<TypeModeledMethod>;
};

export type MethodArgumentOptions = {
  options: MethodArgument[];
  defaultArgumentPath: string;
};

export type ModelsAsDataLanguage = {
  /**
   * The modes that are available for this language. If not specified, all
   * modes are available.
   */
  availableModes?: Mode[];
  createMethodSignature: (method: MethodDefinition) => string;
  /**
   * This allows modifying the endpoint type automatically assigned to an endpoint. The default
   * endpoint type is undefined, and if this method returns undefined, the default endpoint type will
   * be determined by heuristics.
   * @param method The method to get the endpoint type for. The endpoint type can be undefined if the
   *               query does not return an endpoint type.
   * @param endpointKind An optional column that may be provided by the query to help determine the
   *                     endpoint type.
   */
  endpointTypeForEndpoint?: (
    method: Omit<MethodDefinition, "endpointType"> & {
      endpointType: EndpointType | undefined;
    },
    endpointKind: string | undefined,
  ) => EndpointType | undefined;
  predicates: ModelsAsDataLanguagePredicates;
  modelGeneration?: ModelsAsDataLanguageModelGeneration;
  autoModelGeneration?: ModelsAsDataLanguageAutoModelGeneration;
  accessPathSuggestions?: ModelsAsDataLanguageAccessPathSuggestions;
  /**
   * Returns the list of valid arguments that can be selected for the given method.
   * @param method The method to get the valid arguments for.
   */
  getArgumentOptions: (method: MethodDefinition) => MethodArgumentOptions;
};
