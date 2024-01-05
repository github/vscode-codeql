import { TreeItem, TreeItemCollapsibleState, Uri } from "vscode";

export class QueryTreeViewItem extends TreeItem {
  constructor(
    name: string,
    public readonly path: string,
    public readonly children: QueryTreeViewItem[],
  ) {
    super(name);
  }
}

export function createQueryTreeFolderItem(
  name: string,
  path: string,
  children: QueryTreeViewItem[],
): QueryTreeViewItem {
  const item = new QueryTreeViewItem(name, path, children);
  item.tooltip = path;
  item.collapsibleState = TreeItemCollapsibleState.Collapsed;
  item.contextValue = "queryFolder";
  return item;
}

export function createQueryTreeFileItem(
  name: string,
  path: string,
  language: string | undefined,
): QueryTreeViewItem {
  const item = new QueryTreeViewItem(name, path, []);
  item.tooltip = path;
  item.description = language;
  item.collapsibleState = TreeItemCollapsibleState.None;
  item.contextValue = "queryFile";
  item.command = {
    title: "Open",
    command: "vscode.open",
    arguments: [Uri.file(path)],
  };
  return item;
}
