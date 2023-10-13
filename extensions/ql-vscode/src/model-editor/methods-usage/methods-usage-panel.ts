import { TreeView, window } from "vscode";
import { DisposableObject } from "../../common/disposable-object";
import {
  MethodsUsageDataProvider,
  MethodsUsageTreeViewItem,
} from "./methods-usage-data-provider";
import { Method, Usage } from "../method";
import { DatabaseItem } from "../../databases/local-databases";
import { CodeQLCliServer } from "../../codeql-cli/cli";
import { ModelingStore } from "../modeling-store";
import { ModeledMethod } from "../modeled-method";
import { Mode } from "../shared/mode";

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
  }

  public async setState(
    methods: readonly Method[],
    databaseItem: DatabaseItem,
    hideModeledMethods: boolean,
    mode: Mode,
    modeledMethods: Readonly<Record<string, readonly ModeledMethod[]>>,
    modifiedMethodSignatures: ReadonlySet<string>,
  ): Promise<void> {
    await this.dataProvider.setState(
      methods,
      databaseItem,
      hideModeledMethods,
      mode,
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
      this.modelingStore.onModeChanged(async (event) => {
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
        activeState.mode,
        activeState.modeledMethods,
        activeState.modifiedMethodSignatures,
      );
    }
  }
}
