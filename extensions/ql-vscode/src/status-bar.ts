import {
  ConfigurationChangeEvent,
  StatusBarAlignment,
  StatusBarItem,
  window,
  workspace,
} from "vscode";
import { CodeQLCliServer } from "./cli";
import {
  CANARY_FEATURES,
  CUSTOM_CODEQL_PATH_SETTING,
  DistributionConfigListener,
} from "./config";
import { DisposableObject } from "./pure/disposable-object";

/**
 * Creates and manages a status bar item for codeql. THis item contains
 * the current codeQL cli version as well as a notification if you are
 * in canary mode
 *
 */
export class CodeQlStatusBarHandler extends DisposableObject {
  private readonly item: StatusBarItem;

  constructor(
    private cli: CodeQLCliServer,
    distributionConfigListener: DistributionConfigListener,
  ) {
    super();
    this.item = window.createStatusBarItem(StatusBarAlignment.Right);
    this.push(this.item);
    this.push(
      workspace.onDidChangeConfiguration(
        this.handleDidChangeConfiguration,
        this,
      ),
    );
    this.push(
      distributionConfigListener.onDidChangeConfiguration(() =>
        this.updateStatusItem(),
      ),
    );
    this.item.command = "codeQL.copyVersion";
    void this.updateStatusItem();
  }

  private handleDidChangeConfiguration(e: ConfigurationChangeEvent) {
    if (
      e.affectsConfiguration(CANARY_FEATURES.qualifiedName) ||
      e.affectsConfiguration(CUSTOM_CODEQL_PATH_SETTING.qualifiedName)
    ) {
      // Wait a few seconds before updating the status item.
      // This avoids a race condition where the cli's version
      // is not updated before the status bar is refreshed.
      setTimeout(() => this.updateStatusItem(), 3000);
    }
  }

  private async updateStatusItem() {
    const canary = CANARY_FEATURES.getValue() ? " (Canary)" : "";
    // since getting the version may take a few seconds, initialize with some
    // meaningful text.
    this.item.text = `CodeQL${canary}`;

    const version = await this.cli.getVersion();
    this.item.text = `CodeQL CLI v${version}${canary}`;
    this.item.show();
  }
}
