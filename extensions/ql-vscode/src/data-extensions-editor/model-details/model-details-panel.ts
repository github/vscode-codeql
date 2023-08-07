import { window } from "vscode";
import { DisposableObject } from "../../common/disposable-object";
import { ModelDetailsDataProvider } from "./model-details-data-provider";

export class ModelDetailsPanel extends DisposableObject {
  public constructor() {
    super();

    const dataProvider = new ModelDetailsDataProvider();

    const treeView = window.createTreeView("codeQLModelDetails", {
      treeDataProvider: dataProvider,
    });
    this.push(treeView);
  }
}
