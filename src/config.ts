import { workspace, Event, EventEmitter, ConfigurationChangeEvent, window } from 'vscode';
import { DisposableObject } from './disposable-object';
import * as path from 'path';
import { QLConfigurationData } from './configData';

const DISTRIBUTION_PATH = 'distributionPath';

export class QLConfiguration extends DisposableObject {
  private readonly onDidChangeDistributionPathEmitter = this.push(new EventEmitter<void>());
  private _qlDistributionPath?;

  constructor() {
    super();
    this.updateConfiguration();
    this.push(workspace.onDidChangeConfiguration(this.handleDidChangeConfiguration, this));
  }
  
  public get onDidChangeDistributionPath(): Event<void> {
    return this.onDidChangeDistributionPathEmitter.event;
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

  public get configData(): QLConfigurationData {
    return {
      qlDistributionPath: this.qlDistributionPath!,
      javaCommand: this.javaCommand!,
    };
  }

  private handleDidChangeConfiguration(e: ConfigurationChangeEvent): void {
    if (e.affectsConfiguration(`ql.${DISTRIBUTION_PATH}`)) {
      this.updateConfiguration();
    }
  }

  private updateConfiguration(): void {
    this._qlDistributionPath = workspace.getConfiguration('ql').get(DISTRIBUTION_PATH) as string;
    if (!this.qlDistributionPath) {
      window.showErrorMessage(`Semmle distribution must be configured. Set the 'ql.${DISTRIBUTION_PATH}' setting.`);
    }
    this.onDidChangeDistributionPathEmitter.fire();
  }
}
