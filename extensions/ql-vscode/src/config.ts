import { workspace, Event, EventEmitter, ConfigurationChangeEvent } from 'vscode';
import { DisposableObject } from 'semmle-vscode-utils';
import * as path from 'path';
import * as helpers from './helpers';

const DISTRIBUTION_PATH = 'distributionPath';
const QUERY_SERVER_SETTINGS_SECTION = 'ql.runningQueries';
const NUMBER_OF_THREADS_SETTING = 'numberOfThreads';
const TIMEOUT_SETTING = 'timeout';
const MEMORY_SETTING = 'memory';
const QUERY_SERVER_RESTARTING_SETTINGS = [DISTRIBUTION_PATH, NUMBER_OF_THREADS_SETTING, MEMORY_SETTING];

export interface QLConfiguration {
  javaCommand: string | undefined,
  numThreads: number,
  qlDistributionPath: string;
  queryMemoryMb: number,
  timeoutSecs: number,
  onDidChangeQueryServerConfiguration?: Event<void>;
}

export class QLConfigurationListener extends DisposableObject implements QLConfiguration {
  private readonly _onDidChangeQueryServerConfiguration = this.push(new EventEmitter<void>());
  private _qlDistributionPath: string | undefined;
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

  public get qlDistributionPath(): string {
    return this._qlDistributionPath!;
  }

  public get javaCommand(): string | undefined {
    if (this._qlDistributionPath) {
      return path.resolve(this._qlDistributionPath, 'tools/java/bin/java');
    } else {
      return undefined;
    }
  }

  public get numThreads(): number {
    return this._numThreads;
  }

  /** Gets the configured query timeout, in seconds. This looks up the setting at the time of access. */
  public get timeoutSecs(): number {
    return workspace.getConfiguration(QUERY_SERVER_SETTINGS_SECTION).get(TIMEOUT_SETTING) as number;
  }

  public get queryMemoryMb(): number {
    return this._queryMemoryMb;
  }

  private handleDidChangeConfiguration(e: ConfigurationChangeEvent): void {
    // Check whether any options that affect query running were changed.
    for(const option of QUERY_SERVER_RESTARTING_SETTINGS) {
      // TODO: compare old and new values, only update if there was actually a change?
      if (e.affectsConfiguration(`${QUERY_SERVER_SETTINGS_SECTION}.${option}`)) {
        this.updateConfiguration();
        break; // only need to do this once, if any of the settings have changed
      }
    }
  }

  private updateConfiguration(): void {
    this._qlDistributionPath = workspace.getConfiguration('ql').get(DISTRIBUTION_PATH) as string;
    this._numThreads = workspace.getConfiguration(QUERY_SERVER_SETTINGS_SECTION).get(NUMBER_OF_THREADS_SETTING) as number;
    this._queryMemoryMb = workspace.getConfiguration(QUERY_SERVER_SETTINGS_SECTION).get(MEMORY_SETTING) as number;
    if (!this.qlDistributionPath) {
      helpers.showAndLogErrorMessage(`Semmle distribution must be configured. Set the 'ql.${DISTRIBUTION_PATH}' setting.`);
    }
    this._onDidChangeQueryServerConfiguration.fire();
  }
}
