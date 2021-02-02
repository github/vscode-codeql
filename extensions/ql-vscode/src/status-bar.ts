import { ConfigurationChangeEvent, StatusBarAlignment, StatusBarItem, window, workspace } from 'vscode';
import { CodeQLCliServer } from './cli';
import { CANARY_FEATURES, DistributionConfigListener } from './config';
import { DisposableObject } from './vscode-utils/disposable-object';

/**
 * Creates and manages a status bar item for codeql. THis item contains
 * the current codeQL cli version as well as a notification if you are
 * in canary mode
 *
 */
export class CodeQlStatusBarHandler extends DisposableObject {

  private readonly item: StatusBarItem;

  constructor(private cli: CodeQLCliServer, distributionConfigListener: DistributionConfigListener) {
    super();
    this.item = window.createStatusBarItem(StatusBarAlignment.Right);
    this.push(this.item);
    this.push(workspace.onDidChangeConfiguration(this.handleDidChangeConfiguration, this));
    this.push(distributionConfigListener.onDidChangeConfiguration(() => this.updateStatusItem()));
    this.item.command = 'codeQL.openDocumentation';
    this.updateStatusItem();
  }

  private handleDidChangeConfiguration(e: ConfigurationChangeEvent) {
    if (e.affectsConfiguration(CANARY_FEATURES.qualifiedName)) {
      this.updateStatusItem();
    }
  }

  private async updateStatusItem() {
    const canary = CANARY_FEATURES.getValue() ? ' (Canary)' : '';
    // since getting the verison may take a few seconds, initialize with some
    // meaningful text.
    this.item.text = `CodeQL${canary}`;

    const version = await this.cli.getVersion();
    this.item.text = `CodeQL CLI v${version}${canary}`;
    this.item.show();
  }
}
