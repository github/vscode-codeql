import type { TreeView } from "vscode";
import { window } from "vscode";
import { DisposableObject } from "../../common/disposable-object";
import type { MethodsUsageTreeViewItem } from "./methods-usage-data-provider";
import { MethodsUsageDataProvider } from "./methods-usage-data-provider";
import type { Method, Usage } from "../method";
import type { DatabaseItem } from "../../databases/local-databases";
import type { CodeQLCliServer } from "../../codeql-cli/cli";
import type { ModelingStore } from "../modeling-store";
import type { ModeledMethod } from "../modeled-method";
import type { Mode } from "../shared/mode";
import type { ModelingEvents } from "../modeling-events";

export class MethodsUsagePanel extends DisposableObject {
  private readonly dataProvider: MethodsUsageDataProvider;
  private readonly treeView: TreeView<MethodsUsageTreeViewItem>;

  public constructor(
    private readonly modelingStore: ModelingStore,
    private readonly modelingEvents: ModelingEvents,
    cliServer: CodeQLCliServer,
  ) {
    super();

    this.dataProvider = new MethodsUsageDataProvider(cliServer);

    this.treeView = window.createTreeView("codeQLMethodsUsage", {
      treeDataProvider: this.dataProvider,
    });
    this.push(this.treeView);

    this.registerToModelingEvents();
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

  private async revealItem(
    methodSignature: string,
    usage: Usage,
  ): Promise<void> {
    const usageTreeViewItem = this.dataProvider.resolveUsageTreeViewItem(
      methodSignature,
      usage,
    );
    if (usageTreeViewItem !== undefined) {
      await this.treeView.reveal(usageTreeViewItem);
    }
  }

  private registerToModelingEvents(): void {
    this.push(
      this.modelingEvents.onActiveDbChanged(async () => {
        await this.handleStateChangeEvent();
      }),
    );

    this.push(
      this.modelingEvents.onMethodsChanged(async (event) => {
        if (event.isActiveDb) {
          await this.handleStateChangeEvent();
        }
      }),
    );

    this.push(
      this.modelingEvents.onHideModeledMethodsChanged(async (event) => {
        if (event.isActiveDb) {
          await this.handleStateChangeEvent();
        }
      }),
    );

    this.push(
      this.modelingEvents.onModeChanged(async (event) => {
        if (event.isActiveDb) {
          await this.handleStateChangeEvent();
        }
      }),
    );

    this.push(
      this.modelingEvents.onModeledAndModifiedMethodsChanged(async (event) => {
        if (event.isActiveDb) {
          await this.handleStateChangeEvent();
        }
      }),
    );

    this.push(
      this.modelingEvents.onSelectedMethodChanged(async (event) => {
        await this.revealItem(event.method.signature, event.usage);
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
