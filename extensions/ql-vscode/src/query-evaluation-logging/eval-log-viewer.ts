import type { TreeDataProvider, TreeView, ProviderResult, Event } from "vscode";
import {
  window,
  TreeItem,
  EventEmitter,
  TreeItemCollapsibleState,
} from "vscode";
import { DisposableObject } from "../common/disposable-object";
import { asError, getErrorMessage } from "../common/helpers-pure";
import { redactableError } from "../common/errors";
import type { EvalLogViewerCommands } from "../common/commands";
import { extLogger } from "../common/logging/vscode";
import { showAndLogExceptionWithTelemetry } from "../common/logging";
import { telemetryListener } from "../common/vscode/telemetry";

export interface EvalLogTreeItem {
  label?: string;
  children: ChildEvalLogTreeItem[];
}

export interface ChildEvalLogTreeItem extends EvalLogTreeItem {
  parent: ChildEvalLogTreeItem | EvalLogTreeItem;
}

/** Provides data from parsed CodeQL evaluator logs to be rendered in a tree view. */
class EvalLogDataProvider
  extends DisposableObject
  implements TreeDataProvider<EvalLogTreeItem>
{
  public roots: EvalLogTreeItem[] = [];

  private _onDidChangeTreeData: EventEmitter<
    EvalLogTreeItem | undefined | null | void
  > = new EventEmitter<EvalLogTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: Event<
    EvalLogTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: EvalLogTreeItem): TreeItem | Thenable<TreeItem> {
    const state = element.children.length
      ? TreeItemCollapsibleState.Collapsed
      : TreeItemCollapsibleState.None;
    const treeItem = new TreeItem(element.label || "", state);
    treeItem.tooltip = `${treeItem.label} || ''}`;
    return treeItem;
  }

  getChildren(element?: EvalLogTreeItem): ProviderResult<EvalLogTreeItem[]> {
    // If no item is passed, return the root.
    if (!element) {
      return this.roots || [];
    }
    // Otherwise it is called with an existing item, to load its children.
    return element.children;
  }

  getParent(element: ChildEvalLogTreeItem): ProviderResult<EvalLogTreeItem> {
    return element.parent;
  }
}

/** Manages a tree viewer of structured evaluator logs. */
export class EvalLogViewer extends DisposableObject {
  private treeView: TreeView<EvalLogTreeItem>;
  private treeDataProvider: EvalLogDataProvider;

  constructor() {
    super();

    this.treeDataProvider = new EvalLogDataProvider();
    this.treeView = window.createTreeView("codeQLEvalLogViewer", {
      treeDataProvider: this.treeDataProvider,
      showCollapseAll: true,
    });

    this.push(this.treeView);
    this.push(this.treeDataProvider);
  }

  public getCommands(): EvalLogViewerCommands {
    return {
      "codeQLEvalLogViewer.clear": async () => this.clear(),
    };
  }

  private clear(): void {
    this.treeDataProvider.roots = [];
    this.treeDataProvider.refresh();
    this.treeView.message = undefined;
  }

  // Called when the Show Evaluator Log (UI) command is run on a new query.
  updateRoots(roots: EvalLogTreeItem[]): void {
    this.treeDataProvider.roots = roots;
    this.treeDataProvider.refresh();

    this.treeView.message = "Viewer for query run:"; // Currently only one query supported at a time.

    // Handle error on reveal. This could happen if
    // the tree view is disposed during the reveal.
    this.treeView.reveal(roots[0], { focus: false })?.then(
      () => {
        /**/
      },
      (err: unknown) =>
        showAndLogExceptionWithTelemetry(
          extLogger,
          telemetryListener,
          redactableError(
            asError(err),
          )`Failed to reveal tree view: ${getErrorMessage(err)}`,
        ),
    );
  }
}
