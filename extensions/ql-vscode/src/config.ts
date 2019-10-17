import { workspace, Event, EventEmitter, ConfigurationChangeEvent } from 'vscode';
import { DisposableObject } from 'semmle-vscode-utils';
import * as helpers from './helpers';

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
const RUNNING_QUERIES_SETTING = new Setting('runningQueries', ROOT_SETTING);
const DISTRIBUTION_PATH_SETTING = new Setting('distributionPath', ROOT_SETTING);
const NUMBER_OF_THREADS_SETTING = new Setting('numberOfThreads', RUNNING_QUERIES_SETTING);
const TIMEOUT_SETTING = new Setting('timeout', RUNNING_QUERIES_SETTING);
const MEMORY_SETTING = new Setting('memory', RUNNING_QUERIES_SETTING);

/** When these settings change, the running query server should be restarted. */
const QUERY_SERVER_RESTARTING_SETTINGS = [DISTRIBUTION_PATH_SETTING, NUMBER_OF_THREADS_SETTING, MEMORY_SETTING];

export interface QLConfiguration {
  codeQlPath: string,
  numThreads: number,
  queryMemoryMb: number,
  timeoutSecs: number,
  onDidChangeQueryServerConfiguration?: Event<void>;
}

export class QLConfigurationListener extends DisposableObject implements QLConfiguration {
  private readonly _onDidChangeQueryServerConfiguration = this.push(new EventEmitter<void>());
  private _codeQlPath: string | undefined;
  private _numThreads: number;
  private _queryMemoryMb: number;

  constructor() {
    super();
    this.updateConfiguration();
    this.push(workspace.onDidChangeConfiguration(this.handleDidChangeConfiguration, this));
  }

  public get onDidChangeQueryServerConfiguration(): Event<void> {
    return this._onDidChangeQueryServerConfiguration.event;
  }

  public get codeQlPath(): string {
    return this._codeQlPath!;
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

  private handleDidChangeConfiguration(e: ConfigurationChangeEvent): void {
    // Check whether any options that affect query running were changed.
    for(const option of QUERY_SERVER_RESTARTING_SETTINGS) {
      // TODO: compare old and new values, only update if there was actually a change?
      if (e.affectsConfiguration(option.qualifiedName)) {
        this.updateConfiguration();
        break; // only need to do this once, if any of the settings have changed
      }
    }
  }

  private updateConfiguration(): void {
    this._codeQlPath = DISTRIBUTION_PATH_SETTING.getValue<string>();
    this._numThreads = NUMBER_OF_THREADS_SETTING.getValue<number>();
    this._queryMemoryMb = MEMORY_SETTING.getValue<number>();
    if (!this.codeQlPath) {
      helpers.showAndLogErrorMessage(`CodeQL distribution must be configured. Set the '${DISTRIBUTION_PATH_SETTING.qualifiedName}' setting.`);
    }
    this._onDidChangeQueryServerConfiguration.fire();
  }
}
