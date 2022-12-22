import {
  QuickPickItem,
  TreeView,
  TreeViewExpansionEvent,
  window,
  workspace,
} from "vscode";
import { commandRunner, UserCancellationException } from "../../commandRunner";
import {
  getNwoFromGitHubUrl,
  isValidGitHubNwo,
  getOwnerFromGitHubUrl,
  isValidGitHubOwner,
} from "../../common/github-url-identifier-helper";
import { showAndLogErrorMessage } from "../../helpers";
import { DisposableObject } from "../../pure/disposable-object";
import { DbItem, DbItemKind, DbListKind, remoteDbKinds } from "../db-item";
import { DbManager } from "../db-manager";
import { DbTreeDataProvider } from "./db-tree-data-provider";
import { DbTreeViewItem } from "./db-tree-view-item";

export interface RemoteDatabaseQuickPickItem extends QuickPickItem {
  kind: string;
}

export interface AddListQuickPickItem extends QuickPickItem {
  kind: DbListKind;
}

export class DbPanel extends DisposableObject {
  private readonly dataProvider: DbTreeDataProvider;
  private readonly treeView: TreeView<DbTreeViewItem>;

  public constructor(private readonly dbManager: DbManager) {
    super();

    this.dataProvider = new DbTreeDataProvider(dbManager);

    this.treeView = window.createTreeView("codeQLDatabasesExperimental", {
      treeDataProvider: this.dataProvider,
      canSelectMany: false,
    });

    this.push(
      this.treeView.onDidCollapseElement(async (e) => {
        await this.onDidCollapseElement(e);
      }),
    );
    this.push(
      this.treeView.onDidExpandElement(async (e) => {
        await this.onDidExpandElement(e);
      }),
    );

    this.push(this.treeView);
  }

  public async initialize(): Promise<void> {
    this.push(
      commandRunner("codeQLDatabasesExperimental.openConfigFile", () =>
        this.openConfigFile(),
      ),
    );
    this.push(
      commandRunner("codeQLDatabasesExperimental.addNewDatabase", () =>
        this.addNewRemoteDatabase(),
      ),
    );
    this.push(
      commandRunner("codeQLDatabasesExperimental.addNewList", () =>
        this.addNewList(),
      ),
    );
    this.push(
      commandRunner(
        "codeQLDatabasesExperimental.setSelectedItem",
        (treeViewItem: DbTreeViewItem) => this.setSelectedItem(treeViewItem),
      ),
    );
  }

  private async openConfigFile(): Promise<void> {
    const configPath = this.dbManager.getConfigPath();
    const document = await workspace.openTextDocument(configPath);
    await window.showTextDocument(document);
  }

  private async addNewRemoteDatabase(): Promise<void> {
    const highlightedItem = await this.getHighlightedDbItem();

    if (highlightedItem?.kind === DbItemKind.RemoteUserDefinedList) {
      await this.addNewRemoteRepo(highlightedItem.listName);
    } else if (
      highlightedItem?.kind === DbItemKind.RemoteRepo &&
      highlightedItem.parentListName
    ) {
      await this.addNewRemoteRepo(highlightedItem.parentListName);
    } else {
      const quickPickItems = [
        {
          label: "$(repo) From a GitHub repository",
          detail: "Add a remote repository from GitHub",
          alwaysShow: true,
          kind: "repo",
        },
        {
          label: "$(organization) All repositories of a GitHub org or owner",
          detail:
            "Add a remote list of repositories from a GitHub organization/owner",
          alwaysShow: true,
          kind: "owner",
        },
      ];
      const databaseKind =
        await window.showQuickPick<RemoteDatabaseQuickPickItem>(
          quickPickItems,
          {
            title: "Add a remote repository",
            placeHolder: "Select an option",
            ignoreFocusOut: true,
          },
        );
      if (!databaseKind) {
        // We don't need to display a warning pop-up in this case, since the user just escaped out of the operation.
        // We set 'true' to make this a silent exception.
        throw new UserCancellationException("No repository selected", true);
      }
      if (databaseKind.kind === "repo") {
        await this.addNewRemoteRepo();
      } else if (databaseKind.kind === "owner") {
        await this.addNewRemoteOwner();
      }
    }
  }

  private async addNewRemoteRepo(parentList?: string): Promise<void> {
    const repoName = await window.showInputBox({
      title: "Add a remote repository",
      prompt: "Insert a GitHub repository URL or name with owner",
      placeHolder: "github.com/<owner>/<repo> or <owner>/<repo>",
    });
    if (!repoName) {
      return;
    }

    const nwo = getNwoFromGitHubUrl(repoName) || repoName;
    if (!isValidGitHubNwo(nwo)) {
      void showAndLogErrorMessage(`Invalid GitHub repository: ${repoName}`);
      return;
    }

    if (this.dbManager.doesRemoteRepoExist(nwo, parentList)) {
      void showAndLogErrorMessage(`The repository '${nwo}' already exists`);
      return;
    }

    await this.dbManager.addNewRemoteRepo(nwo, parentList);
  }

  private async addNewRemoteOwner(): Promise<void> {
    const ownerName = await window.showInputBox({
      title: "Add all repositories of a GitHub org or owner",
      prompt: "Insert a GitHub organization or owner name",
      placeHolder: "github.com/<owner> or <owner>",
    });

    if (!ownerName) {
      return;
    }

    const owner = getOwnerFromGitHubUrl(ownerName) || ownerName;
    if (!isValidGitHubOwner(owner)) {
      void showAndLogErrorMessage(`Invalid user or organization: ${owner}`);
      return;
    }

    if (this.dbManager.doesRemoteOwnerExist(owner)) {
      void showAndLogErrorMessage(`The owner '${owner}' already exists`);
      return;
    }

    await this.dbManager.addNewRemoteOwner(owner);
  }

  private async addNewList(): Promise<void> {
    const listKind = await this.getAddNewListKind();

    const listName = await window.showInputBox({
      prompt: "Enter a name for the new list",
      placeHolder: "example-list",
    });
    if (listName === undefined || listName === "") {
      return;
    }

    if (this.dbManager.doesListExist(listKind, listName)) {
      void showAndLogErrorMessage(`The list '${listName}' already exists`);
      return;
    }

    await this.dbManager.addNewList(listKind, listName);
  }

  private async getAddNewListKind(): Promise<DbListKind> {
    const highlightedItem = await this.getHighlightedDbItem();
    if (highlightedItem) {
      return remoteDbKinds.includes(highlightedItem.kind)
        ? DbListKind.Remote
        : DbListKind.Local;
    } else {
      const quickPickItems = [
        {
          label: "$(cloud) Remote",
          detail: "Add a remote database from GitHub",
          alwaysShow: true,
          kind: DbListKind.Remote,
        },
        {
          label: "$(database) Local",
          detail: "Import a database from the cloud or a local file",
          alwaysShow: true,
          kind: DbListKind.Local,
        },
      ];
      const selectedOption = await window.showQuickPick<AddListQuickPickItem>(
        quickPickItems,
        {
          title: "Add a new database",
          ignoreFocusOut: true,
        },
      );
      if (!selectedOption) {
        // We don't need to display a warning pop-up in this case, since the user just escaped out of the operation.
        // We set 'true' to make this a silent exception.
        throw new UserCancellationException(
          "No database list kind selected",
          true,
        );
      }

      return selectedOption.kind;
    }
  }

  private async setSelectedItem(treeViewItem: DbTreeViewItem): Promise<void> {
    if (treeViewItem.dbItem === undefined) {
      throw new Error(
        "Not a selectable database item. Please select a valid item.",
      );
    }
    await this.dbManager.setSelectedDbItem(treeViewItem.dbItem);
  }

  private async onDidCollapseElement(
    event: TreeViewExpansionEvent<DbTreeViewItem>,
  ): Promise<void> {
    const dbItem = event.element.dbItem;
    if (!dbItem) {
      throw Error("Expected a database item.");
    }

    await this.dbManager.updateDbItemExpandedState(event.element.dbItem, false);
  }

  private async onDidExpandElement(
    event: TreeViewExpansionEvent<DbTreeViewItem>,
  ): Promise<void> {
    const dbItem = event.element.dbItem;
    if (!dbItem) {
      throw Error("Expected a database item.");
    }

    await this.dbManager.updateDbItemExpandedState(event.element.dbItem, true);
  }

  /**
   * Gets the currently highlighted database item in the tree view.
   * The VS Code API calls this the "selection", but we already have a notion of selection
   * (i.e. which item has a check mark next to it), so we call this "highlighted".
   *
   * @returns The highlighted database item, or `undefined` if no item is highlighted.
   */
  private async getHighlightedDbItem(): Promise<DbItem | undefined> {
    // You can only select one item at a time, so selection[0] gives the selection
    return this.treeView.selection[0]?.dbItem;
  }
}
