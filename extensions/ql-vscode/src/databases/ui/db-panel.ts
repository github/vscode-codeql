import {
  ProgressLocation,
  QuickPickItem,
  TreeView,
  TreeViewExpansionEvent,
  Uri,
  window,
  workspace,
} from "vscode";
import { UserCancellationException } from "../../common/vscode/progress";
import {
  getNwoFromGitHubUrl,
  isValidGitHubNwo,
  getOwnerFromGitHubUrl,
  isValidGitHubOwner,
} from "../../common/github-url-identifier-helper";
import {
  showAndLogErrorMessage,
  showAndLogInformationMessage,
} from "../../helpers";
import { DisposableObject } from "../../pure/disposable-object";
import {
  DbItem,
  DbItemKind,
  DbListKind,
  LocalDatabaseDbItem,
  LocalListDbItem,
  RemoteUserDefinedListDbItem,
} from "../db-item";
import { getDbItemName } from "../db-item-naming";
import { DbManager } from "../db-manager";
import { DbTreeDataProvider } from "./db-tree-data-provider";
import { DbTreeViewItem } from "./db-tree-view-item";
import { getGitHubUrl } from "./db-tree-view-item-action";
import { getControllerRepo } from "../../variant-analysis/run-remote-query";
import { getErrorMessage } from "../../pure/helpers-pure";
import { DatabasePanelCommands } from "../../common/commands";
import { App } from "../../common/app";
import { getCodeSearchRepositories } from "../../variant-analysis/gh-api/gh-api-client";
import { QueryLanguage } from "../../common/query-language";

export interface RemoteDatabaseQuickPickItem extends QuickPickItem {
  remoteDatabaseKind: string;
}

export interface AddListQuickPickItem extends QuickPickItem {
  databaseKind: DbListKind;
}

export interface CodeSearchQuickPickItem extends QuickPickItem {
  language: string;
}

export class DbPanel extends DisposableObject {
  private readonly dataProvider: DbTreeDataProvider;
  private readonly treeView: TreeView<DbTreeViewItem>;

  public constructor(
    private readonly app: App,
    private readonly dbManager: DbManager,
  ) {
    super();

    this.dataProvider = new DbTreeDataProvider(dbManager);

    this.treeView = window.createTreeView("codeQLVariantAnalysisRepositories", {
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

  public getCommands(): DatabasePanelCommands {
    return {
      "codeQLVariantAnalysisRepositories.openConfigFile":
        this.openConfigFile.bind(this),
      "codeQLVariantAnalysisRepositories.addNewDatabase":
        this.addNewRemoteDatabase.bind(this),
      "codeQLVariantAnalysisRepositories.addNewList":
        this.addNewList.bind(this),
      "codeQLVariantAnalysisRepositories.setupControllerRepository":
        this.setupControllerRepository.bind(this),

      "codeQLVariantAnalysisRepositories.setSelectedItem":
        this.setSelectedItem.bind(this),
      "codeQLVariantAnalysisRepositories.setSelectedItemContextMenu":
        this.setSelectedItem.bind(this),
      "codeQLVariantAnalysisRepositories.openOnGitHubContextMenu":
        this.openOnGitHub.bind(this),
      "codeQLVariantAnalysisRepositories.renameItemContextMenu":
        this.renameItem.bind(this),
      "codeQLVariantAnalysisRepositories.removeItemContextMenu":
        this.removeItem.bind(this),
      "codeQLVariantAnalysisRepositories.importCodeSearch":
        this.importCodeSearch.bind(this),
    };
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
      const quickPickItems: RemoteDatabaseQuickPickItem[] = [
        {
          label: "$(repo) From a GitHub repository",
          detail: "Add a variant analysis repository from GitHub",
          alwaysShow: true,
          remoteDatabaseKind: "repo",
        },
        {
          label: "$(organization) All repositories of a GitHub org or owner",
          detail:
            "Add a variant analysis list of repositories from a GitHub organization/owner",
          alwaysShow: true,
          remoteDatabaseKind: "owner",
        },
      ];
      const databaseKind =
        await window.showQuickPick<RemoteDatabaseQuickPickItem>(
          quickPickItems,
          {
            title: "Add a variant analysis repository",
            placeHolder: "Select an option",
            ignoreFocusOut: true,
          },
        );
      if (!databaseKind) {
        // We don't need to display a warning pop-up in this case, since the user just escaped out of the operation.
        // We set 'true' to make this a silent exception.
        throw new UserCancellationException("No repository selected", true);
      }
      if (databaseKind.remoteDatabaseKind === "repo") {
        await this.addNewRemoteRepo();
      } else if (databaseKind.remoteDatabaseKind === "owner") {
        await this.addNewRemoteOwner();
      }
    }
  }

  private async addNewRemoteRepo(parentList?: string): Promise<void> {
    const repoName = await window.showInputBox({
      title: "Add a repository",
      prompt: "Insert a GitHub repository URL or name with owner",
      placeHolder: "<owner>/<repo> or https://github.com/<owner>/<repo>",
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

    const truncatedRepositories = await this.dbManager.addNewRemoteRepo(
      nwo,
      parentList,
    );

    if (parentList) {
      this.truncatedReposNote(truncatedRepositories, parentList);
    }
  }

  private async addNewRemoteOwner(): Promise<void> {
    const ownerName = await window.showInputBox({
      title: "Add all repositories of a GitHub org or owner",
      prompt: "Insert a GitHub organization or owner name",
      placeHolder: "<owner> or https://github.com/<owner>",
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
    const listKind = DbListKind.Remote;

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

  private async setSelectedItem(treeViewItem: DbTreeViewItem): Promise<void> {
    if (treeViewItem.dbItem === undefined) {
      throw new Error(
        "Not a selectable database item. Please select a valid item.",
      );
    }

    // Optimistically update the UI to select the item that the user
    // selected to avoid delay in the UI.
    this.dataProvider.updateSelectedItem(treeViewItem);

    await this.dbManager.setSelectedDbItem(treeViewItem.dbItem);
  }

  private async renameItem(treeViewItem: DbTreeViewItem): Promise<void> {
    const dbItem = treeViewItem.dbItem;
    if (dbItem === undefined) {
      throw new Error(
        "Not a database item that can be renamed. Please select a valid item.",
      );
    }

    const oldName = getDbItemName(dbItem);

    const newName = await window.showInputBox({
      prompt: "Enter the new name",
      value: oldName,
    });

    if (newName === undefined || newName === "") {
      return;
    }

    switch (dbItem.kind) {
      case DbItemKind.LocalList:
        await this.renameLocalListItem(dbItem, newName);
        break;
      case DbItemKind.LocalDatabase:
        await this.renameLocalDatabaseItem(dbItem, newName);
        break;
      case DbItemKind.RemoteUserDefinedList:
        await this.renameVariantAnalysisUserDefinedListItem(dbItem, newName);
        break;
      default:
        throw Error(`Action not allowed for the '${dbItem.kind}' db item kind`);
    }
  }

  private async renameLocalListItem(
    dbItem: LocalListDbItem,
    newName: string,
  ): Promise<void> {
    if (dbItem.listName === newName) {
      return;
    }

    if (this.dbManager.doesListExist(DbListKind.Local, newName)) {
      void showAndLogErrorMessage(`The list '${newName}' already exists`);
      return;
    }

    await this.dbManager.renameList(dbItem, newName);
  }

  private async renameLocalDatabaseItem(
    dbItem: LocalDatabaseDbItem,
    newName: string,
  ): Promise<void> {
    if (dbItem.databaseName === newName) {
      return;
    }

    if (this.dbManager.doesLocalDbExist(newName, dbItem.parentListName)) {
      void showAndLogErrorMessage(`The database '${newName}' already exists`);
      return;
    }

    await this.dbManager.renameLocalDb(dbItem, newName);
  }

  private async renameVariantAnalysisUserDefinedListItem(
    dbItem: RemoteUserDefinedListDbItem,
    newName: string,
  ): Promise<void> {
    if (dbItem.listName === newName) {
      return;
    }

    if (this.dbManager.doesListExist(DbListKind.Remote, newName)) {
      void showAndLogErrorMessage(`The list '${newName}' already exists`);
      return;
    }

    await this.dbManager.renameList(dbItem, newName);
  }

  private async removeItem(treeViewItem: DbTreeViewItem): Promise<void> {
    if (treeViewItem.dbItem === undefined) {
      throw new Error(
        "Not a removable database item. Please select a valid item.",
      );
    }
    await this.dbManager.removeDbItem(treeViewItem.dbItem);
  }

  private async importCodeSearch(treeViewItem: DbTreeViewItem): Promise<void> {
    if (treeViewItem.dbItem?.kind !== DbItemKind.RemoteUserDefinedList) {
      throw new Error("Please select a valid list to add code search results.");
    }

    const listName = treeViewItem.dbItem.listName;

    const languageQuickPickItems: CodeSearchQuickPickItem[] = Object.values(
      QueryLanguage,
    ).map((language) => ({
      label: language.toString(),
      alwaysShow: true,
      language: language.toString(),
    }));

    const codeSearchLanguage =
      await window.showQuickPick<CodeSearchQuickPickItem>(
        languageQuickPickItems,
        {
          title: "Select the language you want to query",
          placeHolder: "Select an option",
          ignoreFocusOut: true,
        },
      );
    if (!codeSearchLanguage) {
      // We don't need to display a warning pop-up in this case, since the user just escaped out of the operation.
      // We set 'true' to make this a silent exception.
      throw new UserCancellationException("No language selected", true);
    }

    const codeSearchQuery = await window.showInputBox({
      title: "Code search query",
      prompt: "Insert code search query",
      placeHolder: "org:github",
    });
    if (codeSearchQuery === undefined || codeSearchQuery === "") {
      return;
    }

    void window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: "Searching for repositories... This might take a while",
        cancellable: true,
      },
      async (progress, token) => {
        progress.report({ increment: 10 });

        const repositories = await getCodeSearchRepositories(
          this.app.credentials,
          `${codeSearchQuery} language:${codeSearchLanguage.language}`,
          progress,
          token,
        );

        token.onCancellationRequested(() => {
          void showAndLogInformationMessage("Code search cancelled");
          return;
        });

        progress.report({ increment: 10, message: "Processing results..." });

        const truncatedRepositories =
          await this.dbManager.addNewRemoteReposToList(repositories, listName);
        this.truncatedReposNote(truncatedRepositories, listName);
      },
    );
  }

  private truncatedReposNote(
    truncatedRepositories: string[],
    listName: string,
  ) {
    if (truncatedRepositories.length > 0) {
      void showAndLogErrorMessage(
        `Some repositories were not added to '${listName}' because a list can only have 1000 entries. Excluded repositories: ${truncatedRepositories.join(
          ", ",
        )}`,
      );
    }
  }

  private async onDidCollapseElement(
    event: TreeViewExpansionEvent<DbTreeViewItem>,
  ): Promise<void> {
    const dbItem = event.element.dbItem;
    if (!dbItem) {
      throw Error("Expected a database item.");
    }

    await this.dbManager.removeDbItemFromExpandedState(event.element.dbItem);
  }

  private async onDidExpandElement(
    event: TreeViewExpansionEvent<DbTreeViewItem>,
  ): Promise<void> {
    const dbItem = event.element.dbItem;
    if (!dbItem) {
      throw Error("Expected a database item.");
    }

    await this.dbManager.addDbItemToExpandedState(event.element.dbItem);
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

  private async openOnGitHub(treeViewItem: DbTreeViewItem): Promise<void> {
    if (treeViewItem.dbItem === undefined) {
      throw new Error("Unable to open on GitHub. Please select a valid item.");
    }
    const githubUrl = getGitHubUrl(treeViewItem.dbItem);
    if (!githubUrl) {
      throw new Error(
        "Unable to open on GitHub. Please select a variant analysis repository or owner.",
      );
    }

    await this.app.commands.execute("vscode.open", Uri.parse(githubUrl));
  }

  private async setupControllerRepository(): Promise<void> {
    try {
      // This will also validate that the controller repository is valid
      await getControllerRepo(this.app.credentials);
    } catch (e: unknown) {
      if (e instanceof UserCancellationException) {
        return;
      }

      void showAndLogErrorMessage(
        `An error occurred while setting up the controller repository: ${getErrorMessage(
          e,
        )}`,
      );
    }
  }
}
