import type {
  TreeDataProvider,
  Event,
  ProviderResult,
  TreeView,
  TextEditorSelectionChangeEvent,
  Location,
  Uri,
} from "vscode";
import {
  window,
  EventEmitter,
  TreeItemCollapsibleState,
  TreeItem,
  TextEditorSelectionChangeKind,
  Range,
} from "vscode";
import { basename } from "path";

import type { DatabaseItem } from "../../databases/local-databases";
import type { BqrsId } from "../../common/bqrs-cli-types";
import { showLocation } from "../../databases/local-databases/locations";
import { DisposableObject } from "../../common/disposable-object";
import {
  asError,
  assertNever,
  getErrorMessage,
} from "../../common/helpers-pure";
import { redactableError } from "../../common/errors";
import type { AstViewerCommands } from "../../common/commands";
import { extLogger } from "../../common/logging/vscode";
import { showAndLogExceptionWithTelemetry } from "../../common/logging";
import { telemetryListener } from "../../common/vscode/telemetry";
import type { UrlValue } from "../../common/raw-result-types";

export interface AstItem {
  id: BqrsId;
  label?: string;
  location?: UrlValue;
  fileLocation?: Location;
  children: ChildAstItem[];
  order: number;
}

export interface ChildAstItem extends AstItem {
  parent: ChildAstItem | AstItem;
}

class AstViewerDataProvider
  extends DisposableObject
  implements TreeDataProvider<AstItem>
{
  public roots: AstItem[] = [];
  public db: DatabaseItem | undefined;

  private _onDidChangeTreeData = this.push(
    new EventEmitter<AstItem | undefined>(),
  );
  readonly onDidChangeTreeData: Event<AstItem | undefined> =
    this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
  getChildren(item?: AstItem): ProviderResult<AstItem[]> {
    const children = item ? item.children : this.roots;
    return children.sort((c1, c2) => c1.order - c2.order);
  }

  getParent(item: ChildAstItem): ProviderResult<AstItem> {
    return item.parent;
  }

  getTreeItem(item: AstItem): TreeItem {
    const line = this.extractLineInfo(item?.location);

    const state = item.children.length
      ? TreeItemCollapsibleState.Collapsed
      : TreeItemCollapsibleState.None;
    const treeItem = new TreeItem(item.label || "", state);
    treeItem.description = line ? `Line ${line}` : "";
    treeItem.id = String(item.id);
    treeItem.tooltip = `${treeItem.description} ${treeItem.label}`;
    treeItem.command = {
      command: "codeQLAstViewer.gotoCode",
      title: "Go To Code",
      tooltip: `Go To ${item.location}`,
      arguments: [item],
    };
    return treeItem;
  }

  private extractLineInfo(loc?: UrlValue) {
    if (!loc) {
      return;
    }

    switch (loc.type) {
      case "string":
        return loc.value;
      case "wholeFileLocation":
        return loc.uri;
      case "lineColumnLocation":
        return loc.startLine;
      default:
        assertNever(loc);
    }
  }
}

export class AstViewer extends DisposableObject {
  private treeView: TreeView<AstItem>;
  private treeDataProvider: AstViewerDataProvider;
  private currentFileUri: Uri | undefined;

  constructor() {
    super();

    this.treeDataProvider = new AstViewerDataProvider();
    this.treeView = window.createTreeView("codeQLAstViewer", {
      treeDataProvider: this.treeDataProvider,
      showCollapseAll: true,
    });

    this.push(this.treeView);
    this.push(this.treeDataProvider);
    this.push(
      window.onDidChangeTextEditorSelection(this.updateTreeSelection, this),
    );
  }

  getCommands(): AstViewerCommands {
    return {
      "codeQLAstViewer.clear": async () => this.clear(),
      "codeQLAstViewer.gotoCode": async (item: AstItem) => {
        await showLocation(item.fileLocation);
      },
    };
  }

  updateRoots(roots: AstItem[], db: DatabaseItem, fileUri: Uri) {
    this.treeDataProvider.roots = roots;
    this.treeDataProvider.db = db;
    this.treeDataProvider.refresh();
    this.treeView.message = `AST for ${basename(fileUri.fsPath)}`;
    this.currentFileUri = fileUri;
    // Handle error on reveal. This could happen if
    // the tree view is disposed during the reveal.
    this.treeView.reveal(roots[0], { focus: false })?.then(
      () => {
        /**/
      },
      (error: unknown) =>
        showAndLogExceptionWithTelemetry(
          extLogger,
          telemetryListener,
          redactableError(
            asError(error),
          )`Failed to reveal AST: ${getErrorMessage(error)}`,
        ),
    );
  }

  private updateTreeSelection(e: TextEditorSelectionChangeEvent) {
    function isInside(selectedRange: Range, astRange?: Range): boolean {
      return !!astRange?.contains(selectedRange);
    }

    // Recursively iterate all children until we find the node with the smallest
    // range that contains the selection.
    // Some nodes do not have a location, but their children might, so must
    // recurse though location-less AST nodes to see if children are correct.
    function findBest(
      selectedRange: Range,
      items?: AstItem[],
    ): AstItem | undefined {
      if (!items || !items.length) {
        return;
      }
      for (const item of items) {
        let candidate: AstItem | undefined = undefined;
        if (isInside(selectedRange, item.fileLocation?.range)) {
          candidate = item;
        }
        // always iterate through children since the location of an AST node in code QL does not
        // always cover the complete text of the node.
        candidate = findBest(selectedRange, item.children) || candidate;
        if (candidate) {
          return candidate;
        }
      }
      return;
    }

    // Avoid recursive tree-source code updates.
    if (e.kind === TextEditorSelectionChangeKind.Command) {
      return;
    }

    if (
      this.treeView.visible &&
      e.textEditor.document.uri.fsPath === this.currentFileUri?.fsPath &&
      e.selections.length === 1
    ) {
      const selection = e.selections[0];
      const range = selection.anchor.isBefore(selection.active)
        ? new Range(selection.anchor, selection.active)
        : new Range(selection.active, selection.anchor);

      const targetItem = findBest(range, this.treeDataProvider.roots);
      if (targetItem) {
        // Handle error on reveal. This could happen if
        // the tree view is disposed during the reveal.
        this.treeView.reveal(targetItem)?.then(
          () => {
            /**/
          },
          (error: unknown) =>
            showAndLogExceptionWithTelemetry(
              extLogger,
              telemetryListener,
              redactableError(
                asError(error),
              )`Failed to reveal AST: ${getErrorMessage(error)}`,
            ),
        );
      }
    }
  }

  private clear() {
    this.treeDataProvider.roots = [];
    this.treeDataProvider.db = undefined;
    this.treeDataProvider.refresh();
    this.treeView.message = undefined;
    this.currentFileUri = undefined;
  }
}
