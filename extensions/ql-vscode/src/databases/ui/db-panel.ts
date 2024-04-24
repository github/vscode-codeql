import type { QuickPickItem, TreeView, TreeViewExpansionEvent } from "vscode";
import { Uri, window, workspace } from "vscode";
import {
  UserCancellationException,
  withProgress,
} from "../../common/vscode/progress";
import {
  getNwoFromGitHubUrl,
  isValidGitHubNwo,
  getOwnerFromGitHubUrl,
  isValidGitHubOwner,
} from "../../common/github-url-identifier-helper";
import { DisposableObject } from "../../common/disposable-object";
import type { DbItem, RemoteUserDefinedListDbItem } from "../db-item";
import { DbItemKind } from "../db-item";
import { getDbItemName } from "../db-item-naming";
import type { DbManager } from "../db-manager";
import { DbTreeDataProvider } from "./db-tree-data-provider";
import type { DbTreeViewItem } from "./db-tree-view-item";
import { getGitHubUrl } from "./db-tree-view-item-action";
import { getControllerRepo } from "../../variant-analysis/run-remote-query";
import { getErrorMessage } from "../../common/helpers-pure";
import type { DatabasePanelCommands } from "../../common/commands";
import type { App } from "../../common/app";
import { QueryLanguage } from "../../common/query-language";
import { getCodeSearchRepositories } from "../code-search-api";
import { showAndLogErrorMessage } from "../../common/logging";
import { getGitHubInstanceUrl } from "../../config";

export interface RemoteDatabaseQuickPickItem extends QuickPickItem {
  remoteDatabaseKind: string;
}

interface CodeSearchQuickPickItem extends QuickPickItem {
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
      "codeQLVariantAnalysisRepositories.importFromCodeSearch":
        this.importFromCodeSearch.bind(this),
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
    const instanceUrl = getGitHubInstanceUrl();

    const repoName = await window.showInputBox({
      title: "Add a repository",
      prompt: "Insert a GitHub repository URL or name with owner",
      placeHolder: `<owner>/<repo> or ${new URL("/", instanceUrl).toString()}<owner>/<repo>`,
    });
    if (!repoName) {
      return;
    }

    const nwo =
      getNwoFromGitHubUrl(repoName, getGitHubInstanceUrl()) || repoName;
    if (!isValidGitHubNwo(nwo)) {
      void showAndLogErrorMessage(
        this.app.logger,
        `Invalid GitHub repository: ${repoName}`,
      );
      return;
    }

    if (this.dbManager.doesRemoteRepoExist(nwo, parentList)) {
      void showAndLogErrorMessage(
        this.app.logger,
        `The repository '${nwo}' already exists`,
      );
      return;
    }

    await this.dbManager.addNewRemoteRepo(nwo, parentList);
  }

  private async addNewRemoteOwner(): Promise<void> {
    const instanceUrl = getGitHubInstanceUrl();

    const ownerName = await window.showInputBox({
      title: "Add all repositories of a GitHub org or owner",
      prompt: "Insert a GitHub organization or owner name",
      placeHolder: `<owner> or ${new URL("/", instanceUrl).toString()}<owner>`,
    });

    if (!ownerName) {
      return;
    }

    const owner =
      getOwnerFromGitHubUrl(ownerName, getGitHubInstanceUrl()) || ownerName;
    if (!isValidGitHubOwner(owner)) {
      void showAndLogErrorMessage(
        this.app.logger,
        `Invalid user or organization: ${owner}`,
      );
      return;
    }

    if (this.dbManager.doesRemoteOwnerExist(owner)) {
      void showAndLogErrorMessage(
        this.app.logger,
        `The owner '${owner}' already exists`,
      );
      return;
    }

    await this.dbManager.addNewRemoteOwner(owner);
  }

  private async addNewList(): Promise<void> {
    const listName = await window.showInputBox({
      prompt: "Enter a name for the new list",
      placeHolder: "example-list",
    });
    if (listName === undefined || listName === "") {
      return;
    }

    if (this.dbManager.doesListExist(listName)) {
      void showAndLogErrorMessage(
        this.app.logger,
        `The list '${listName}' already exists`,
      );
      return;
    }

    await this.dbManager.addNewList(listName);
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

    if (dbItem.kind === DbItemKind.RemoteUserDefinedList) {
      await this.renameVariantAnalysisUserDefinedListItem(dbItem, newName);
    } else {
      throw Error(`Action not allowed for the '${dbItem.kind}' db item kind`);
    }
  }

  private async renameVariantAnalysisUserDefinedListItem(
    dbItem: RemoteUserDefinedListDbItem,
    newName: string,
  ): Promise<void> {
    if (dbItem.listName === newName) {
      return;
    }

    if (this.dbManager.doesListExist(newName)) {
      void showAndLogErrorMessage(
        this.app.logger,
        `The list '${newName}' already exists`,
      );
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

  private async importFromCodeSearch(
    treeViewItem: DbTreeViewItem,
  ): Promise<void> {
    if (treeViewItem.dbItem?.kind !== DbItemKind.RemoteUserDefinedList) {
      throw new Error("Please select a valid list to add code search results.");
    }

    const listName = treeViewItem.dbItem.listName;

    const languageQuickPickItems: CodeSearchQuickPickItem[] = [
      {
        label: "No specific language",
        alwaysShow: true,
        language: "",
      },
    ].concat(
      Object.values(QueryLanguage).map((language) => ({
        label: language.toString(),
        alwaysShow: true,
        language: language.toString(),
      })),
    );

    const codeSearchLanguage =
      await window.showQuickPick<CodeSearchQuickPickItem>(
        languageQuickPickItems,
        {
          title: "Select a language for your search",
          placeHolder: "Select an option",
          ignoreFocusOut: true,
        },
      );
    if (!codeSearchLanguage) {
      return;
    }

    const languagePrompt = codeSearchLanguage.language
      ? `language:${codeSearchLanguage.language}`
      : "";

    const codeSearchQuery = await window.showInputBox({
      title: "GitHub Code Search",
      prompt:
        "Use [GitHub's Code Search syntax](https://docs.github.com/en/search-github/searching-on-github/searching-code), to search for repositories.",
      placeHolder: "org:github",
    });
    if (codeSearchQuery === undefined || codeSearchQuery === "") {
      return;
    }

    await withProgress(
      async (progress, token) => {
        const repositories = await getCodeSearchRepositories(
          `${codeSearchQuery} ${languagePrompt}`,
          progress,
          token,
          this.app.credentials,
          this.app.logger,
        );

        if (token.isCancellationRequested) {
          throw new UserCancellationException("Code search cancelled.", true);
        }

        progress({
          maxStep: 12,
          step: 12,
          message: "Processing results...",
        });

        await this.dbManager.addNewRemoteReposToList(repositories, listName);
      },
      {
        title: "Searching for repositories...",
        cancellable: true,
      },
    );
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
    const githubUrl = getGitHubUrl(treeViewItem.dbItem, getGitHubInstanceUrl());
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
        this.app.logger,
        `An error occurred while setting up the controller repository: ${getErrorMessage(
          e,
        )}`,
      );
    }
  }
}
