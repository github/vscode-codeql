import { workspace, Event, EventEmitter, ConfigurationChangeEvent, window } from 'vscode';
import { DisposableObject } from 'semmle-vscode-utils';
import * as path from 'path';
import { QLConfigurationData } from './configData';

const DISTRIBUTION_PATH = 'distributionPath';
const NUM_THREADS = 'numThreads';
const TIMEOUT_SECS = 'timeoutSecs';
const QUERY_MEMORY_MB = 'queryMemoryMb';
const _QUERY_SERVER_RESTARTING_OPTIONS = [DISTRIBUTION_PATH, NUM_THREADS, QUERY_MEMORY_MB];

export class QLConfiguration extends DisposableObject {
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

  public get qlDistributionPath(): string | undefined {
    return this._qlDistributionPath;
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

  public get timeoutSecs(): number {
    return workspace.getConfiguration('ql').get(TIMEOUT_SECS) as number;
  }

  public get queryMemoryMb(): number {
    return this._queryMemoryMb;
  }

  public get configData(): QLConfigurationData {
    return {
      qlDistributionPath: this.qlDistributionPath!,
      javaCommand: this.javaCommand!,
      numThreads: this.numThreads!,
      timeoutSecs: this.timeoutSecs,
      queryMemoryMb: this.queryMemoryMb
    };
  }

  private handleDidChangeConfiguration(e: ConfigurationChangeEvent): void {
    // Check whether any options that affect query running were changed.
    for(const option of _QUERY_SERVER_RESTARTING_OPTIONS) {
      // TODO: compare old and new values, only update if there was actually a change?
      if (e.affectsConfiguration(`ql.${option}`)) {
        this.updateConfiguration();
        break; // only need to do this once, if any of the settings have changed
      }
    }
  }

  private updateConfiguration(): void {
    this._qlDistributionPath = workspace.getConfiguration('ql').get(DISTRIBUTION_PATH) as string;
    this._numThreads = workspace.getConfiguration('ql').get(NUM_THREADS) as number;
    this._queryMemoryMb = workspace.getConfiguration('ql').get(QUERY_MEMORY_MB) as number;
    if (!this.qlDistributionPath) {
      window.showErrorMessage(`Semmle distribution must be configured. Set the 'ql.${DISTRIBUTION_PATH}' setting.`);
    }
    this._onDidChangeQueryServerConfiguration.fire();
  }
}
