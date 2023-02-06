import { DisposableObject } from "./pure/disposable-object";
import {
  workspace,
  Event,
  EventEmitter,
  ConfigurationChangeEvent,
  ConfigurationTarget,
} from "vscode";
import { DistributionManager } from "./distribution";
import { extLogger } from "./common";
import { ONE_DAY_IN_MS } from "./pure/time";

export const ALL_SETTINGS: Setting[] = [];

/** Helper class to look up a labelled (and possibly nested) setting. */
export class Setting {
  name: string;
  parent?: Setting;
  private _hasChildren = false;

  constructor(name: string, parent?: Setting) {
    this.name = name;
    this.parent = parent;
    if (parent !== undefined) {
      parent._hasChildren = true;
    }
    ALL_SETTINGS.push(this);
  }

  get hasChildren() {
    return this._hasChildren;
  }

  get qualifiedName(): string {
    if (this.parent === undefined) {
      return this.name;
    } else {
      return `${this.parent.qualifiedName}.${this.name}`;
    }
  }

  getValue<T>(): T {
    if (this.parent === undefined) {
      throw new Error("Cannot get the value of a root setting.");
    }
    return workspace
      .getConfiguration(this.parent.qualifiedName)
      .get<T>(this.name)!;
  }

  updateValue<T>(value: T, target: ConfigurationTarget): Thenable<void> {
    if (this.parent === undefined) {
      throw new Error("Cannot update the value of a root setting.");
    }
    return workspace
      .getConfiguration(this.parent.qualifiedName)
      .update(this.name, value, target);
  }

  inspect<T>(): InspectionResult<T> | undefined {
    if (this.parent === undefined) {
      throw new Error("Cannot update the value of a root setting.");
    }
    return workspace
      .getConfiguration(this.parent.qualifiedName)
      .inspect(this.name);
  }
}

export interface InspectionResult<T> {
  globalValue?: T;
  workspaceValue?: T;
  workspaceFolderValue?: T;
}

const ROOT_SETTING = new Setting("codeQL");

// Global configuration
const TELEMETRY_SETTING = new Setting("telemetry", ROOT_SETTING);
const AST_VIEWER_SETTING = new Setting("astViewer", ROOT_SETTING);
const GLOBAL_TELEMETRY_SETTING = new Setting("telemetry");
const LOG_INSIGHTS_SETTING = new Setting("logInsights", ROOT_SETTING);

export const LOG_TELEMETRY = new Setting("logTelemetry", TELEMETRY_SETTING);
export const ENABLE_TELEMETRY = new Setting(
  "enableTelemetry",
  TELEMETRY_SETTING,
);

export const GLOBAL_ENABLE_TELEMETRY = new Setting(
  "enableTelemetry",
  GLOBAL_TELEMETRY_SETTING,
);

const ENABLE_NEW_TELEMETRY = new Setting(
  "enableNewTelemetry",
  TELEMETRY_SETTING,
);

export function newTelemetryEnabled(): boolean {
  return ENABLE_NEW_TELEMETRY.getValue<boolean>();
}

// Distribution configuration
const DISTRIBUTION_SETTING = new Setting("cli", ROOT_SETTING);
export const CUSTOM_CODEQL_PATH_SETTING = new Setting(
  "executablePath",
  DISTRIBUTION_SETTING,
);
const INCLUDE_PRERELEASE_SETTING = new Setting(
  "includePrerelease",
  DISTRIBUTION_SETTING,
);
const PERSONAL_ACCESS_TOKEN_SETTING = new Setting(
  "personalAccessToken",
  DISTRIBUTION_SETTING,
);

// Query History configuration
const QUERY_HISTORY_SETTING = new Setting("queryHistory", ROOT_SETTING);
const QUERY_HISTORY_FORMAT_SETTING = new Setting(
  "format",
  QUERY_HISTORY_SETTING,
);
const QUERY_HISTORY_TTL = new Setting("ttl", QUERY_HISTORY_SETTING);

/** When these settings change, the distribution should be updated. */
const DISTRIBUTION_CHANGE_SETTINGS = [
  CUSTOM_CODEQL_PATH_SETTING,
  INCLUDE_PRERELEASE_SETTING,
  PERSONAL_ACCESS_TOKEN_SETTING,
];

export interface DistributionConfig {
  readonly customCodeQlPath?: string;
  updateCustomCodeQlPath: (newPath: string | undefined) => Promise<void>;
  includePrerelease: boolean;
  personalAccessToken?: string;
  ownerName?: string;
  repositoryName?: string;
  onDidChangeConfiguration?: Event<void>;
}

// Query server configuration
const RUNNING_QUERIES_SETTING = new Setting("runningQueries", ROOT_SETTING);
const NUMBER_OF_THREADS_SETTING = new Setting(
  "numberOfThreads",
  RUNNING_QUERIES_SETTING,
);
const SAVE_CACHE_SETTING = new Setting("saveCache", RUNNING_QUERIES_SETTING);
const CACHE_SIZE_SETTING = new Setting("cacheSize", RUNNING_QUERIES_SETTING);
const TIMEOUT_SETTING = new Setting("timeout", RUNNING_QUERIES_SETTING);
const MEMORY_SETTING = new Setting("memory", RUNNING_QUERIES_SETTING);
const DEBUG_SETTING = new Setting("debug", RUNNING_QUERIES_SETTING);
const MAX_PATHS = new Setting("maxPaths", RUNNING_QUERIES_SETTING);
const RUNNING_TESTS_SETTING = new Setting("runningTests", ROOT_SETTING);
const RESULTS_DISPLAY_SETTING = new Setting("resultsDisplay", ROOT_SETTING);

export const ADDITIONAL_TEST_ARGUMENTS_SETTING = new Setting(
  "additionalTestArguments",
  RUNNING_TESTS_SETTING,
);
export const NUMBER_OF_TEST_THREADS_SETTING = new Setting(
  "numberOfThreads",
  RUNNING_TESTS_SETTING,
);
export const MAX_QUERIES = new Setting("maxQueries", RUNNING_QUERIES_SETTING);
export const AUTOSAVE_SETTING = new Setting(
  "autoSave",
  RUNNING_QUERIES_SETTING,
);
export const PAGE_SIZE = new Setting("pageSize", RESULTS_DISPLAY_SETTING);
const CUSTOM_LOG_DIRECTORY_SETTING = new Setting(
  "customLogDirectory",
  RUNNING_QUERIES_SETTING,
);

/** When these settings change, the running query server should be restarted. */
const QUERY_SERVER_RESTARTING_SETTINGS = [
  NUMBER_OF_THREADS_SETTING,
  SAVE_CACHE_SETTING,
  CACHE_SIZE_SETTING,
  MEMORY_SETTING,
  DEBUG_SETTING,
  CUSTOM_LOG_DIRECTORY_SETTING,
];

export interface QueryServerConfig {
  codeQlPath: string;
  debug: boolean;
  numThreads: number;
  saveCache: boolean;
  cacheSize: number;
  queryMemoryMb?: number;
  timeoutSecs: number;
  customLogDirectory?: string;
  onDidChangeConfiguration?: Event<void>;
}

/** When these settings change, the query history should be refreshed. */
const QUERY_HISTORY_SETTINGS = [
  QUERY_HISTORY_FORMAT_SETTING,
  QUERY_HISTORY_TTL,
];

export interface QueryHistoryConfig {
  format: string;
  ttlInMillis: number;
  onDidChangeConfiguration: Event<void>;
}

const CLI_SETTINGS = [
  ADDITIONAL_TEST_ARGUMENTS_SETTING,
  NUMBER_OF_TEST_THREADS_SETTING,
  NUMBER_OF_THREADS_SETTING,
  MAX_PATHS,
];

export interface CliConfig {
  additionalTestArguments: string[];
  numberTestThreads: number;
  numberThreads: number;
  maxPaths: number;
  onDidChangeConfiguration?: Event<void>;
}

export abstract class ConfigListener extends DisposableObject {
  protected readonly _onDidChangeConfiguration = this.push(
    new EventEmitter<void>(),
  );

  constructor() {
    super();
    this.updateConfiguration();
    this.push(
      workspace.onDidChangeConfiguration(
        this.handleDidChangeConfiguration,
        this,
      ),
    );
  }

  /**
   * Calls `updateConfiguration` if any of the `relevantSettings` have changed.
   */
  protected handleDidChangeConfigurationForRelevantSettings(
    relevantSettings: Setting[],
    e: ConfigurationChangeEvent,
  ): void {
    // Check whether any options that affect query running were changed.
    for (const option of relevantSettings) {
      // TODO: compare old and new values, only update if there was actually a change?
      if (e.affectsConfiguration(option.qualifiedName)) {
        this.updateConfiguration();
        break; // only need to do this once, if any of the settings have changed
      }
    }
  }

  protected abstract handleDidChangeConfiguration(
    e: ConfigurationChangeEvent,
  ): void;
  private updateConfiguration(): void {
    this._onDidChangeConfiguration.fire(undefined);
  }

  public get onDidChangeConfiguration(): Event<void> {
    return this._onDidChangeConfiguration.event;
  }
}

export class DistributionConfigListener
  extends ConfigListener
  implements DistributionConfig
{
  public get customCodeQlPath(): string | undefined {
    return CUSTOM_CODEQL_PATH_SETTING.getValue() || undefined;
  }

  public get includePrerelease(): boolean {
    return INCLUDE_PRERELEASE_SETTING.getValue();
  }

  public get personalAccessToken(): string | undefined {
    return PERSONAL_ACCESS_TOKEN_SETTING.getValue() || undefined;
  }

  public async updateCustomCodeQlPath(newPath: string | undefined) {
    await CUSTOM_CODEQL_PATH_SETTING.updateValue(
      newPath,
      ConfigurationTarget.Global,
    );
  }

  protected handleDidChangeConfiguration(e: ConfigurationChangeEvent): void {
    this.handleDidChangeConfigurationForRelevantSettings(
      DISTRIBUTION_CHANGE_SETTINGS,
      e,
    );
  }
}

export class QueryServerConfigListener
  extends ConfigListener
  implements QueryServerConfig
{
  public constructor(private _codeQlPath = "") {
    super();
  }

  public static async createQueryServerConfigListener(
    distributionManager: DistributionManager,
  ): Promise<QueryServerConfigListener> {
    const codeQlPath =
      await distributionManager.getCodeQlPathWithoutVersionCheck();
    const config = new QueryServerConfigListener(codeQlPath!);
    if (distributionManager.onDidChangeDistribution) {
      config.push(
        distributionManager.onDidChangeDistribution(async () => {
          const codeQlPath =
            await distributionManager.getCodeQlPathWithoutVersionCheck();
          config._codeQlPath = codeQlPath!;
          config._onDidChangeConfiguration.fire(undefined);
        }),
      );
    }
    return config;
  }

  public get codeQlPath(): string {
    return this._codeQlPath;
  }

  public get customLogDirectory(): string | undefined {
    return CUSTOM_LOG_DIRECTORY_SETTING.getValue<string>() || undefined;
  }

  public get numThreads(): number {
    return NUMBER_OF_THREADS_SETTING.getValue<number>();
  }

  public get saveCache(): boolean {
    return SAVE_CACHE_SETTING.getValue<boolean>();
  }

  public get cacheSize(): number {
    return CACHE_SIZE_SETTING.getValue<number | null>() || 0;
  }

  /** Gets the configured query timeout, in seconds. This looks up the setting at the time of access. */
  public get timeoutSecs(): number {
    return TIMEOUT_SETTING.getValue<number | null>() || 0;
  }

  public get queryMemoryMb(): number | undefined {
    const memory = MEMORY_SETTING.getValue<number | null>();
    if (memory === null) {
      return undefined;
    }
    if (memory === 0 || typeof memory !== "number") {
      void extLogger.log(
        `Ignoring value '${memory}' for setting ${MEMORY_SETTING.qualifiedName}`,
      );
      return undefined;
    }
    return memory;
  }

  public get debug(): boolean {
    return DEBUG_SETTING.getValue<boolean>();
  }

  protected handleDidChangeConfiguration(e: ConfigurationChangeEvent): void {
    this.handleDidChangeConfigurationForRelevantSettings(
      QUERY_SERVER_RESTARTING_SETTINGS,
      e,
    );
  }
}

export class QueryHistoryConfigListener
  extends ConfigListener
  implements QueryHistoryConfig
{
  protected handleDidChangeConfiguration(e: ConfigurationChangeEvent): void {
    this.handleDidChangeConfigurationForRelevantSettings(
      QUERY_HISTORY_SETTINGS,
      e,
    );
  }

  public get format(): string {
    return QUERY_HISTORY_FORMAT_SETTING.getValue<string>();
  }

  /**
   * The configuration value is in days, but return the value in milliseconds to make it easier to use.
   */
  public get ttlInMillis(): number {
    return (QUERY_HISTORY_TTL.getValue<number>() || 30) * ONE_DAY_IN_MS;
  }
}

export class CliConfigListener extends ConfigListener implements CliConfig {
  public get additionalTestArguments(): string[] {
    return ADDITIONAL_TEST_ARGUMENTS_SETTING.getValue();
  }

  public get numberTestThreads(): number {
    return NUMBER_OF_TEST_THREADS_SETTING.getValue();
  }

  public get numberThreads(): number {
    return NUMBER_OF_THREADS_SETTING.getValue<number>();
  }

  public get maxPaths(): number {
    return MAX_PATHS.getValue<number>();
  }

  protected handleDidChangeConfiguration(e: ConfigurationChangeEvent): void {
    this.handleDidChangeConfigurationForRelevantSettings(CLI_SETTINGS, e);
  }
}

/**
 * Whether to enable CodeLens for the 'Quick Evaluation' command.
 */
const QUICK_EVAL_CODELENS_SETTING = new Setting(
  "quickEvalCodelens",
  RUNNING_QUERIES_SETTING,
);

export function isQuickEvalCodelensEnabled() {
  return QUICK_EVAL_CODELENS_SETTING.getValue<boolean>();
}

// Enable experimental features

/**
 * Any settings below are deliberately not in package.json so that
 * they do not appear in the settings ui in vscode itself. If users
 * want to enable experimental features, they can add them directly in
 * their vscode settings json file.
 */

/**
 * Enables canary features of this extension. Recommended for all internal users.
 */
export const CANARY_FEATURES = new Setting("canary", ROOT_SETTING);

export function isCanary() {
  return !!CANARY_FEATURES.getValue<boolean>();
}

/**
 * Enables the experimental query server
 */
export const CANARY_QUERY_SERVER = new Setting(
  "canaryQueryServer",
  ROOT_SETTING,
);

// The default value for this setting is now `true`
export function allowCanaryQueryServer() {
  const value = CANARY_QUERY_SERVER.getValue<boolean>();
  return value === undefined ? true : !!value;
}

export const JOIN_ORDER_WARNING_THRESHOLD = new Setting(
  "joinOrderWarningThreshold",
  LOG_INSIGHTS_SETTING,
);

export function joinOrderWarningThreshold(): number {
  return JOIN_ORDER_WARNING_THRESHOLD.getValue<number>();
}

/**
 * Avoids caching in the AST viewer if the user is also a canary user.
 */
export const NO_CACHE_AST_VIEWER = new Setting(
  "disableCache",
  AST_VIEWER_SETTING,
);

// Settings for variant analysis
const VARIANT_ANALYSIS_SETTING = new Setting("variantAnalysis", ROOT_SETTING);

/**
 * Lists of GitHub repositories that you want to query remotely via the "Run Variant Analysis" command.
 * Note: This command is only available for internal users.
 *
 * This setting should be a JSON object where each key is a user-specified name (string),
 * and the value is an array of GitHub repositories (of the form `<owner>/<repo>`).
 */
const REMOTE_REPO_LISTS = new Setting(
  "repositoryLists",
  VARIANT_ANALYSIS_SETTING,
);

export function getRemoteRepositoryLists():
  | Record<string, string[]>
  | undefined {
  return REMOTE_REPO_LISTS.getValue<Record<string, string[]>>() || undefined;
}

export async function setRemoteRepositoryLists(
  lists: Record<string, string[]> | undefined,
) {
  await REMOTE_REPO_LISTS.updateValue(lists, ConfigurationTarget.Global);
}

/**
 * Path to a file that contains lists of GitHub repositories that you want to query remotely via
 * the "Run Variant Analysis" command.
 * Note: This command is only available for internal users.
 *
 * This setting should be a path to a JSON file that contains a JSON object where each key is a
 * user-specified name (string), and the value is an array of GitHub repositories
 * (of the form `<owner>/<repo>`).
 */
const REPO_LISTS_PATH = new Setting(
  "repositoryListsPath",
  VARIANT_ANALYSIS_SETTING,
);

export function getRemoteRepositoryListsPath(): string | undefined {
  return REPO_LISTS_PATH.getValue<string>() || undefined;
}

/**
 * The name of the "controller" repository that you want to use with the "Run Variant Analysis" command.
 * Note: This command is only available for internal users.
 *
 * This setting should be a GitHub repository of the form `<owner>/<repo>`.
 */
const REMOTE_CONTROLLER_REPO = new Setting(
  "controllerRepo",
  VARIANT_ANALYSIS_SETTING,
);

export function getRemoteControllerRepo(): string | undefined {
  return REMOTE_CONTROLLER_REPO.getValue<string>() || undefined;
}

export async function setRemoteControllerRepo(repo: string | undefined) {
  await REMOTE_CONTROLLER_REPO.updateValue(repo, ConfigurationTarget.Global);
}

export interface VariantAnalysisConfig {
  controllerRepo: string | undefined;
  onDidChangeConfiguration?: Event<void>;
}

export class VariantAnalysisConfigListener
  extends ConfigListener
  implements VariantAnalysisConfig
{
  protected handleDidChangeConfiguration(e: ConfigurationChangeEvent): void {
    this.handleDidChangeConfigurationForRelevantSettings(
      [VARIANT_ANALYSIS_SETTING],
      e,
    );
  }

  public get controllerRepo(): string | undefined {
    return getRemoteControllerRepo();
  }
}

/**
 * The branch of "github/codeql-variant-analysis-action" to use with the "Run Variant Analysis" command.
 * Default value is "main".
 * Note: This command is only available for internal users.
 */
const ACTION_BRANCH = new Setting("actionBranch", VARIANT_ANALYSIS_SETTING);

export function getActionBranch(): string {
  return ACTION_BRANCH.getValue<string>() || "main";
}

export function isIntegrationTestMode() {
  return process.env.INTEGRATION_TEST_MODE === "true";
}

export function isVariantAnalysisLiveResultsEnabled(): boolean {
  return true;
}

/**
 * A flag indicating whether to use the new "variant analysis repositories" panel.
 */
const VARIANT_ANALYSIS_REPOS_PANEL = new Setting(
  "repositoriesPanel",
  VARIANT_ANALYSIS_SETTING,
);

export function isVariantAnalysisReposPanelEnabled(): boolean {
  return !!VARIANT_ANALYSIS_REPOS_PANEL.getValue<boolean>();
}

// Settings for mocking the GitHub API.
const MOCK_GH_API_SERVER = new Setting("mockGitHubApiServer", ROOT_SETTING);

/**
 * A flag indicating whether to enable a mock GitHub API server.
 */
const MOCK_GH_API_SERVER_ENABLED = new Setting("enabled", MOCK_GH_API_SERVER);

/**
 * A path to a directory containing test scenarios. If this setting is not set,
 * the mock server will a default location for test scenarios in dev mode, and
 * will show a menu to select a directory in production mode.
 */
const MOCK_GH_API_SERVER_SCENARIOS_PATH = new Setting(
  "scenariosPath",
  MOCK_GH_API_SERVER,
);

export interface MockGitHubApiConfig {
  mockServerEnabled: boolean;
  mockScenariosPath: string;
  onDidChangeConfiguration: Event<void>;
}

export class MockGitHubApiConfigListener
  extends ConfigListener
  implements MockGitHubApiConfig
{
  protected handleDidChangeConfiguration(e: ConfigurationChangeEvent): void {
    this.handleDidChangeConfigurationForRelevantSettings(
      [MOCK_GH_API_SERVER],
      e,
    );
  }

  public get mockServerEnabled(): boolean {
    return !!MOCK_GH_API_SERVER_ENABLED.getValue<boolean>();
  }

  public get mockScenariosPath(): string {
    return MOCK_GH_API_SERVER_SCENARIOS_PATH.getValue<string>();
  }
}

export function getMockGitHubApiServerScenariosPath(): string | undefined {
  return MOCK_GH_API_SERVER_SCENARIOS_PATH.getValue<string>();
}
