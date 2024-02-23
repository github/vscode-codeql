import type { EndpointType, MethodArgument, MethodDefinition } from "../method";
import type {
  ModeledMethod,
  NeutralModeledMethod,
  SinkModeledMethod,
  SourceModeledMethod,
  SummaryModeledMethod,
  TypeModeledMethod,
} from "../modeled-method";
import type { DataTuple } from "../model-extension-file";
import type { Mode } from "../shared/mode";
import type { QueryConstraints } from "../../local-queries/query-constraints";
import type {
  DecodedBqrs,
  DecodedBqrsChunk,
} from "../../common/bqrs-cli-types";
import type { BaseLogger } from "../../common/logging";
import type { AccessPathSuggestionRow } from "../suggestions";

type GenerateMethodDefinition<T> = (method: T) => DataTuple[];
type ReadModeledMethod = (row: DataTuple[]) => ModeledMethod;
type IsHiddenContext = {
  method: MethodDefinition;
  isCanary: boolean;
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
) => ModeledMethod[];

type ModelsAsDataLanguageModelGeneration = {
  queryConstraints: (mode: Mode) => QueryConstraints;
  filterQueries?: (queryPath: string) => boolean;
  parseResults: ParseGenerationResults;
  /**
   * If autoRun is not undefined, the query will be run automatically when the user starts the
   * model editor.
   *
   * This only applies to framework mode. Application mode will never run the query automatically.
   */
  autoRun?: {
    /**
     * If defined, will use a custom parsing function when the query is run automatically.
     */
    parseResults?: ParseGenerationResults;
  };
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
   */
  endpointTypeForEndpoint?: (
    method: Omit<MethodDefinition, "endpointType"> & {
      endpointType: EndpointType | undefined;
    },
  ) => EndpointType | undefined;
  predicates: ModelsAsDataLanguagePredicates;
  modelGeneration?: ModelsAsDataLanguageModelGeneration;
  accessPathSuggestions?: ModelsAsDataLanguageAccessPathSuggestions;
  /**
   * Returns the list of valid arguments that can be selected for the given method.
   * @param method The method to get the valid arguments for.
   */
  getArgumentOptions: (method: MethodDefinition) => MethodArgumentOptions;
};
