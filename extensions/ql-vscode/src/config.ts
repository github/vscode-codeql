import { DisposableObject } from './pure/disposable-object';
import { workspace, Event, EventEmitter, ConfigurationChangeEvent, ConfigurationTarget } from 'vscode';
import { DistributionManager } from './distribution';
import { logger } from './logging';

/** Helper class to look up a labelled (and possibly nested) setting. */
export class Setting {
  name: string;
  parent?: Setting;

  constructor(name: string, parent?: Setting) {
    this.name = name;
    this.parent = parent;
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
      throw new Error('Cannot get the value of a root setting.');
    }
    return workspace.getConfiguration(this.parent.qualifiedName).get<T>(this.name)!;
  }

  updateValue<T>(value: T, target: ConfigurationTarget): Thenable<void> {
    if (this.parent === undefined) {
      throw new Error('Cannot update the value of a root setting.');
    }
    return workspace.getConfiguration(this.parent.qualifiedName).update(this.name, value, target);
  }

}

const ROOT_SETTING = new Setting('codeQL');

// Global configuration
const TELEMETRY_SETTING = new Setting('telemetry', ROOT_SETTING);
const AST_VIEWER_SETTING = new Setting('astViewer', ROOT_SETTING);
const GLOBAL_TELEMETRY_SETTING = new Setting('telemetry');

export const LOG_TELEMETRY = new Setting('logTelemetry', TELEMETRY_SETTING);
export const ENABLE_TELEMETRY = new Setting('enableTelemetry', TELEMETRY_SETTING);

export const GLOBAL_ENABLE_TELEMETRY = new Setting('enableTelemetry', GLOBAL_TELEMETRY_SETTING);

// Distribution configuration
const DISTRIBUTION_SETTING = new Setting('cli', ROOT_SETTING);
export const CUSTOM_CODEQL_PATH_SETTING = new Setting('executablePath', DISTRIBUTION_SETTING);
const INCLUDE_PRERELEASE_SETTING = new Setting('includePrerelease', DISTRIBUTION_SETTING);
const PERSONAL_ACCESS_TOKEN_SETTING = new Setting('personalAccessToken', DISTRIBUTION_SETTING);
const QUERY_HISTORY_SETTING = new Setting('queryHistory', ROOT_SETTING);
const QUERY_HISTORY_FORMAT_SETTING = new Setting('format', QUERY_HISTORY_SETTING);

/** When these settings change, the distribution should be updated. */
const DISTRIBUTION_CHANGE_SETTINGS = [CUSTOM_CODEQL_PATH_SETTING, INCLUDE_PRERELEASE_SETTING, PERSONAL_ACCESS_TOKEN_SETTING];

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

const RUNNING_QUERIES_SETTING = new Setting('runningQueries', ROOT_SETTING);
const NUMBER_OF_THREADS_SETTING = new Setting('numberOfThreads', RUNNING_QUERIES_SETTING);
const SAVE_CACHE_SETTING = new Setting('saveCache', RUNNING_QUERIES_SETTING);
const CACHE_SIZE_SETTING = new Setting('cacheSize', RUNNING_QUERIES_SETTING);
const TIMEOUT_SETTING = new Setting('timeout', RUNNING_QUERIES_SETTING);
const MEMORY_SETTING = new Setting('memory', RUNNING_QUERIES_SETTING);
const DEBUG_SETTING = new Setting('debug', RUNNING_QUERIES_SETTING);
const MAX_PATHS = new Setting('maxPaths', RUNNING_QUERIES_SETTING);
const RUNNING_TESTS_SETTING = new Setting('runningTests', ROOT_SETTING);
const RESULTS_DISPLAY_SETTING = new Setting('resultsDisplay', ROOT_SETTING);

export const ADDITIONAL_TEST_ARGUMENTS_SETTING = new Setting('additionalTestArguments', RUNNING_TESTS_SETTING);
export const NUMBER_OF_TEST_THREADS_SETTING = new Setting('numberOfThreads', RUNNING_TESTS_SETTING);
export const MAX_QUERIES = new Setting('maxQueries', RUNNING_QUERIES_SETTING);
export const AUTOSAVE_SETTING = new Setting('autoSave', RUNNING_QUERIES_SETTING);
export const PAGE_SIZE = new Setting('pageSize', RESULTS_DISPLAY_SETTING);
const CUSTOM_LOG_DIRECTORY_SETTING = new Setting('customLogDirectory', RUNNING_QUERIES_SETTING);

/** When these settings change, the running query server should be restarted. */
const QUERY_SERVER_RESTARTING_SETTINGS = [NUMBER_OF_THREADS_SETTING, SAVE_CACHE_SETTING, CACHE_SIZE_SETTING, MEMORY_SETTING, DEBUG_SETTING, CUSTOM_LOG_DIRECTORY_SETTING];

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
const QUERY_HISTORY_SETTINGS = [QUERY_HISTORY_FORMAT_SETTING];

export interface QueryHistoryConfig {
  format: string;
  onDidChangeConfiguration: Event<void>;
}

const CLI_SETTINGS = [ADDITIONAL_TEST_ARGUMENTS_SETTING, NUMBER_OF_TEST_THREADS_SETTING, NUMBER_OF_THREADS_SETTING, MAX_PATHS];

export interface CliConfig {
  additionalTestArguments: string[];
  numberTestThreads: number;
  numberThreads: number;
  maxPaths: number;
  onDidChangeConfiguration?: Event<void>;
}


export abstract class ConfigListener extends DisposableObject {
  protected readonly _onDidChangeConfiguration = this.push(new EventEmitter<void>());

  constructor() {
    super();
    this.updateConfiguration();
    this.push(workspace.onDidChangeConfiguration(this.handleDidChangeConfiguration, this));
  }

  /**
   * Calls `updateConfiguration` if any of the `relevantSettings` have changed.
   */
  protected handleDidChangeConfigurationForRelevantSettings(relevantSettings: Setting[], e: ConfigurationChangeEvent): void {
    // Check whether any options that affect query running were changed.
    for (const option of relevantSettings) {
      // TODO: compare old and new values, only update if there was actually a change?
      if (e.affectsConfiguration(option.qualifiedName)) {
        this.updateConfiguration();
        break; // only need to do this once, if any of the settings have changed
      }
    }
  }

  protected abstract handleDidChangeConfiguration(e: ConfigurationChangeEvent): void;
  private updateConfiguration(): void {
    this._onDidChangeConfiguration.fire(undefined);
  }

  public get onDidChangeConfiguration(): Event<void> {
    return this._onDidChangeConfiguration.event;
  }
}

export class DistributionConfigListener extends ConfigListener implements DistributionConfig {
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
    await CUSTOM_CODEQL_PATH_SETTING.updateValue(newPath, ConfigurationTarget.Global);
  }

  protected handleDidChangeConfiguration(e: ConfigurationChangeEvent): void {
    this.handleDidChangeConfigurationForRelevantSettings(DISTRIBUTION_CHANGE_SETTINGS, e);
  }
}

export class QueryServerConfigListener extends ConfigListener implements QueryServerConfig {
  public constructor(private _codeQlPath = '') {
    super();
  }

  public static async createQueryServerConfigListener(distributionManager: DistributionManager): Promise<QueryServerConfigListener> {
    const codeQlPath = await distributionManager.getCodeQlPathWithoutVersionCheck();
    const config = new QueryServerConfigListener(codeQlPath!);
    if (distributionManager.onDidChangeDistribution) {
      config.push(distributionManager.onDidChangeDistribution(async () => {
        const codeQlPath = await distributionManager.getCodeQlPathWithoutVersionCheck();
        config._codeQlPath = codeQlPath!;
        config._onDidChangeConfiguration.fire(undefined);
      }));
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
    if (memory == 0 || typeof (memory) !== 'number') {
      void logger.log(`Ignoring value '${memory}' for setting ${MEMORY_SETTING.qualifiedName}`);
      return undefined;
    }
    return memory;
  }

  public get debug(): boolean {
    return DEBUG_SETTING.getValue<boolean>();
  }

  protected handleDidChangeConfiguration(e: ConfigurationChangeEvent): void {
    this.handleDidChangeConfigurationForRelevantSettings(QUERY_SERVER_RESTARTING_SETTINGS, e);
  }
}

export class QueryHistoryConfigListener extends ConfigListener implements QueryHistoryConfig {
  protected handleDidChangeConfiguration(e: ConfigurationChangeEvent): void {
    this.handleDidChangeConfigurationForRelevantSettings(QUERY_HISTORY_SETTINGS, e);
  }

  public get format(): string {
    return QUERY_HISTORY_FORMAT_SETTING.getValue<string>();
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
export const CANARY_FEATURES = new Setting('canary', ROOT_SETTING);

export function isCanary() {
  return !!CANARY_FEATURES.getValue<boolean>();
}

/**
 * Avoids caching in the AST viewer if the user is also a canary user.
 */
export const NO_CACHE_AST_VIEWER = new Setting('disableCache', AST_VIEWER_SETTING);

// Settings for remote queries
const REMOTE_QUERIES_SETTING = new Setting('remoteQueries', ROOT_SETTING);

/**
 * Lists of GitHub repositories that you want to query remotely via the "Run Remote query" command.
 * Note: This command is only available for internal users.
 *
 * This setting should be a JSON object where each key is a user-specified name (string),
 * and the value is an array of GitHub repositories (of the form `<owner>/<repo>`).
 */
const REMOTE_REPO_LISTS = new Setting('repositoryLists', REMOTE_QUERIES_SETTING);

export function getRemoteRepositoryLists(): Record<string, string[]> | undefined {
  return REMOTE_REPO_LISTS.getValue<Record<string, string[]>>() || undefined;
}

export async function setRemoteRepositoryLists(lists: Record<string, string[]> | undefined) {
  await REMOTE_REPO_LISTS.updateValue(lists, ConfigurationTarget.Global);
}

/**
 * The name of the "controller" repository that you want to use with the "Run Remote query" command.
 * Note: This command is only available for internal users.
 *
 * This setting should be a GitHub repository of the form `<owner>/<repo>`.
 */
const REMOTE_CONTROLLER_REPO = new Setting('controllerRepo', REMOTE_QUERIES_SETTING);

export function getRemoteControllerRepo(): string | undefined {
  return REMOTE_CONTROLLER_REPO.getValue<string>() || undefined;
}

export async function setRemoteControllerRepo(repo: string | undefined) {
  await REMOTE_CONTROLLER_REPO.updateValue(repo, ConfigurationTarget.Global);
}

/**
 * Whether to insecurely load ML models from CodeQL packs.
 *
 * This setting is for internal users only.
 */
const SHOULD_INSECURELY_LOAD_MODELS_FROM_PACKS =
  new Setting('shouldInsecurelyLoadModelsFromPacks', RUNNING_QUERIES_SETTING);

export function shouldInsecurelyLoadMlModelsFromPacks(): boolean {
  return SHOULD_INSECURELY_LOAD_MODELS_FROM_PACKS.getValue<boolean>();
}
