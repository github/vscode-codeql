import * as vscode from "vscode";

export abstract class QueryTreeViewItem extends vscode.TreeItem {
  protected constructor(name: string) {
    super(name);
  }
}

export class QueryTreeQueryItem extends QueryTreeViewItem {
  constructor(
    name: string,
    public readonly path: string,
    language: string | undefined,
    public readonly children: QueryTreeQueryItem[],
  ) {
    super(name);
    this.tooltip = path;
    if (this.children.length === 0) {
      this.description = language;
      this.collapsibleState = vscode.TreeItemCollapsibleState.None;
      this.contextValue = "queryFile";
      this.command = {
        title: "Open",
        command: "vscode.open",
        arguments: [vscode.Uri.file(path)],
      };
    } else {
      this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
      this.contextValue = "queryFolder";
    }
  }
}

export class QueryTreeTextItem extends QueryTreeViewItem {
  constructor(text: string) {
    super(text);
  }
}
