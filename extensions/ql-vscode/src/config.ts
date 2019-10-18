import { DisposableObject } from 'semmle-vscode-utils';
import { workspace, Event, EventEmitter, ConfigurationChangeEvent } from 'vscode';

/** Helper class to look up a labelled (and possibly nested) setting. */
class Setting {
  name: string;
  parent?: Setting;

  constructor(name: string, parent?: Setting) {
    this.name = name;
    this.parent = parent;
  }

  get qualifiedName(): string {
    if(this.parent === undefined) {
      return this.name;
    } else {
      return `${this.parent.qualifiedName}.${this.name}`;
    }
  }

  getValue<T>(): T {
    if(this.parent === undefined) {
      throw new Error('Cannot get the value of a root setting.');
    }
    return workspace.getConfiguration(this.parent.qualifiedName).get<T>(this.name)!;
  }
}

const ROOT_SETTING =  new Setting('ql');

// Query server configuration

const RUNNING_QUERIES_SETTING = new Setting('runningQueries', ROOT_SETTING);
const NUMBER_OF_THREADS_SETTING = new Setting('numberOfThreads', RUNNING_QUERIES_SETTING);
const TIMEOUT_SETTING = new Setting('timeout', RUNNING_QUERIES_SETTING);
const MEMORY_SETTING = new Setting('memory', RUNNING_QUERIES_SETTING);

/** When these settings change, the running query server should be restarted. */
const QUERY_SERVER_RESTARTING_SETTINGS = [NUMBER_OF_THREADS_SETTING, MEMORY_SETTING];

export interface QueryServerConfig {
  codeQlPath: string,
  numThreads: number,
  queryMemoryMb: number,
  timeoutSecs: number,
  onDidChangeQueryServerConfiguration?: Event<void>;
}

// Distribution configuration

const DISTRIBUTION_SETTING = new Setting('distribution', ROOT_SETTING);
const INCLUDE_PRERELEASE_SETTING = new Setting('includePrerelease', DISTRIBUTION_SETTING);
const PERSONAL_ACCESS_TOKEN_SETTING = new Setting('personalAccessToken', DISTRIBUTION_SETTING);
const OWNER_NAME_SETTING = new Setting('owner', DISTRIBUTION_SETTING);
const REPOSITORY_NAME_SETTING = new Setting('repository', DISTRIBUTION_SETTING);

export interface DistributionConfig {
  includePrerelease: boolean;
  personalAccessToken?: string;
  ownerName: string;
  repositoryName: string;
}

abstract class ConfigListener extends DisposableObject {
  protected readonly _onDidChangeQueryServerConfiguration = this.push(new EventEmitter<void>());

  constructor() {
    super();
    this.updateConfiguration();
    this.push(workspace.onDidChangeConfiguration(this.handleDidChangeConfiguration, this));
  }

  public get onDidChangeQueryServerConfiguration(): Event<void> {
    return this._onDidChangeQueryServerConfiguration.event;
  }

  protected abstract handleDidChangeConfiguration(e: ConfigurationChangeEvent): void;
  protected abstract updateConfiguration(): void;
}

export class DistributionConfigListener extends DisposableObject implements DistributionConfig {
  public get includePrerelease(): boolean {
    return INCLUDE_PRERELEASE_SETTING.getValue();
  }

  public get personalAccessToken(): string | undefined {
    return PERSONAL_ACCESS_TOKEN_SETTING.getValue() !== null ? PERSONAL_ACCESS_TOKEN_SETTING.getValue() : undefined;
  }

  public get ownerName(): string {
    return OWNER_NAME_SETTING.getValue();
  }

  public get repositoryName(): string {
    return REPOSITORY_NAME_SETTING.getValue();
  }
}

export class QueryServerConfigListener extends ConfigListener implements QueryServerConfig {
  private readonly _codeQlPath: string;

  private _numThreads: number;
  private _queryMemoryMb: number;

  constructor(codeQlPath: string) {
    super();
    this._codeQlPath = codeQlPath;
  }

  public get codeQlPath(): string {
    return this._codeQlPath;
  }

  public get numThreads(): number {
    return this._numThreads;
  }

  /** Gets the configured query timeout, in seconds. This looks up the setting at the time of access. */
  public get timeoutSecs(): number {
    return TIMEOUT_SETTING.getValue<number>();
  }

  public get queryMemoryMb(): number {
    return this._queryMemoryMb;
  }

  protected handleDidChangeConfiguration(e: ConfigurationChangeEvent): void {
    // Check whether any options that affect query running were changed.
    for(const option of QUERY_SERVER_RESTARTING_SETTINGS) {
      // TODO: compare old and new values, only update if there was actually a change?
      if (e.affectsConfiguration(option.qualifiedName)) {
        this.updateConfiguration();
        break; // only need to do this once, if any of the settings have changed
      }
    }
  }

  protected updateConfiguration(): void {
    this._numThreads = NUMBER_OF_THREADS_SETTING.getValue<number>();
    this._queryMemoryMb = MEMORY_SETTING.getValue<number>();
    this._onDidChangeQueryServerConfiguration.fire();
  }
}
