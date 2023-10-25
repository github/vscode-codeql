import { DisposableObject } from "../common/disposable-object";
import { QueryTreeDataProvider } from "./query-tree-data-provider";
import { QueryDiscovery } from "./query-discovery";
import { TextEditor, TreeView, window } from "vscode";
import { App } from "../common/app";
import { QueryTreeViewItem } from "./query-tree-view-item";

export class QueriesPanel extends DisposableObject {
  private readonly dataProvider: QueryTreeDataProvider;
  private readonly treeView: TreeView<QueryTreeViewItem>;

  public constructor(
    queryDiscovery: QueryDiscovery,
    readonly app: App,
  ) {
    super();

    this.dataProvider = new QueryTreeDataProvider(queryDiscovery, app);

    this.treeView = window.createTreeView("codeQLQueries", {
      treeDataProvider: this.dataProvider,
    });
    this.push(this.treeView);

    this.subscribeToTreeSelectionEvents();
  }

  private subscribeToTreeSelectionEvents(): void {
    // Keep track of whether the user has changed their text editor while
    // the tree view was not visible. If so, we will focus the text editor
    // in the tree view when it becomes visible.
    let changedTextEditor: TextEditor | undefined = undefined;

    window.onDidChangeActiveTextEditor((textEditor) => {
      if (!this.treeView.visible) {
        changedTextEditor = textEditor;

        return;
      }

      // Reset the changedTextEditor variable so we don't try to show it when
      // the tree view becomes next visible.
      changedTextEditor = undefined;

      if (!textEditor) {
        return;
      }

      void this.revealTextEditor(textEditor);
    });

    this.treeView.onDidChangeVisibility((e) => {
      if (!e.visible) {
        return;
      }

      if (!changedTextEditor) {
        return;
      }

      void this.revealTextEditor(changedTextEditor);
    });
  }

  private revealTextEditor(textEditor: TextEditor): void {
    const filePath = textEditor.document.uri.fsPath;

    const item = this.dataProvider.getTreeItemByPath(filePath);
    if (!item) {
      return;
    }

    if (
      this.treeView.selection.length === 1 &&
      this.treeView.selection[0].path === item.path
    ) {
      // The item is already selected
      return;
    }

    void this.treeView.reveal(item, {
      select: true,
      focus: false,
    });
  }
}
