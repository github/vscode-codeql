import { TreeView, TreeViewExpansionEvent, window } from "vscode";
import { DisposableObject } from "../../common/disposable-object";
import {
  MethodsUsageDataProvider,
  MethodsUsageTreeViewItem,
  isExternalApiMethod,
} from "./methods-usage-data-provider";
import { Method, Usage } from "../method";
import { DatabaseItem } from "../../databases/local-databases";
import { CodeQLCliServer } from "../../codeql-cli/cli";
import { ModelingStore } from "../modeling-store";
import { ModeledMethod } from "../modeled-method";

export class MethodsUsagePanel extends DisposableObject {
  private readonly dataProvider: MethodsUsageDataProvider;
  private readonly treeView: TreeView<MethodsUsageTreeViewItem>;

  public constructor(
    private readonly modelingStore: ModelingStore,
    cliServer: CodeQLCliServer,
  ) {
    super();

    this.dataProvider = new MethodsUsageDataProvider(cliServer);

    this.treeView = window.createTreeView("codeQLMethodsUsage", {
      treeDataProvider: this.dataProvider,
    });
    this.push(this.treeView);

    this.registerToModelingStoreEvents();

    this.push(
      this.treeView.onDidExpandElement(async (e) => {
        await this.onDidExpandElement(e);
      }),
    );
  }

  public async setState(
    methods: Method[],
    databaseItem: DatabaseItem,
    hideModeledMethods: boolean,
    modeledMethods: Record<string, ModeledMethod>,
    modifiedMethodSignatures: Set<string>,
  ): Promise<void> {
    await this.dataProvider.setState(
      methods,
      databaseItem,
      hideModeledMethods,
      modeledMethods,
      modifiedMethodSignatures,
    );
    const numOfApis = hideModeledMethods
      ? methods.filter((api) => !api.supported).length
      : methods.length;
    this.treeView.badge = {
      value: numOfApis,
      tooltip: "Number of external APIs",
    };
  }

  public async revealItem(usage: Usage): Promise<void> {
    const canonicalUsage = this.dataProvider.resolveCanonicalUsage(usage);
    if (canonicalUsage !== undefined) {
      await this.treeView.reveal(canonicalUsage);
    }
  }

  private registerToModelingStoreEvents(): void {
    this.push(
      this.modelingStore.onActiveDbChanged(async () => {
        await this.handleStateChangeEvent();
      }),
    );

    this.push(
      this.modelingStore.onMethodsChanged(async (event) => {
        if (event.isActiveDb) {
          await this.handleStateChangeEvent();
        }
      }),
    );

    this.push(
      this.modelingStore.onHideModeledMethodsChanged(async (event) => {
        if (event.isActiveDb) {
          await this.handleStateChangeEvent();
        }
      }),
    );

    this.push(
      this.modelingStore.onModifiedMethodsChanged(async (event) => {
        if (event.isActiveDb) {
          await this.handleStateChangeEvent();
        }
      }),
    );
  }

  private async handleStateChangeEvent(): Promise<void> {
    const activeState = this.modelingStore.getStateForActiveDb();
    if (activeState !== undefined) {
      await this.setState(
        activeState.methods,
        activeState.databaseItem,
        activeState.hideModeledMethods,
        activeState.modeledMethods,
        activeState.modifiedMethodSignatures,
      );
    }
  }

  private async onDidExpandElement(
    event: TreeViewExpansionEvent<MethodsUsageTreeViewItem>,
  ): Promise<void> {
    const method = event.element;
    if (!isExternalApiMethod(method)) {
      throw Error("Expected an external API method.");
    } else {
      const activeState = this.modelingStore.getStateForActiveDb();
      if (activeState !== undefined) {
        this.modelingStore.setSelectedMethod(
          activeState?.databaseItem,
          method,
          method.usages[0],
        );
      }
    }
  }
}
