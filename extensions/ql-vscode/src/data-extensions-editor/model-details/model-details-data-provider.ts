import { TreeDataProvider, TreeItem } from "vscode";
import { DisposableObject } from "../../common/disposable-object";

export class ModelDetailsDataProvider
  extends DisposableObject
  implements TreeDataProvider<ModelDetailsTreeViewItem>
{
  getTreeItem(): TreeItem {
    throw new Error("Method not implemented.");
  }

  getChildren(): ModelDetailsTreeViewItem[] {
    return [];
  }
}

interface ModelDetailsTreeViewItem {}
