import { window } from "vscode";

import { readJson } from "fs-extra";
import * as path from "path";
import {
  DbConfig,
  SelectedDbItemKind,
} from "../../../../src/databases/config/db-config";
import {
  AddListQuickPickItem,
  CodeSearchQuickPickItem,
  RemoteDatabaseQuickPickItem,
} from "../../../../src/databases/ui/db-panel";
import { DbListKind } from "../../../../src/databases/db-item";
import {
  createDbTreeViewItemSystemDefinedList,
  createDbTreeViewItemUserDefinedList,
} from "../../../../src/databases/ui/db-tree-view-item";
import {
  createRemoteSystemDefinedListDbItem,
  createRemoteUserDefinedListDbItem,
} from "../../../factories/db-item-factories";
import { DbConfigStore } from "../../../../src/databases/config/db-config-store";
import { getActivatedExtension } from "../../global.helper";
import { createVSCodeCommandManager } from "../../../../src/common/vscode/commands";
import { AllCommands } from "../../../../src/common/commands";
import { MockGitHubApiServer } from "../../../../src/variant-analysis/gh-api/mocks/mock-gh-api-server";

jest.setTimeout(60_000);

describe("Db panel UI commands", () => {
  let storagePath: string;
  const commandManager = createVSCodeCommandManager<AllCommands>();

  beforeEach(async () => {
    const extension = await getActivatedExtension();

    storagePath =
      extension.ctx.storageUri?.fsPath || extension.ctx.globalStorageUri.fsPath;
  });

  it("should add new remote db list", async () => {
    // Add db list
    jest.spyOn(window, "showInputBox").mockResolvedValue("my-list-1");
    await commandManager.execute(
      "codeQLVariantAnalysisRepositories.addNewList",
    );

    // Check db config
    const dbConfigFilePath = path.join(
      storagePath,
      DbConfigStore.databaseConfigFileName,
    );
    const dbConfig: DbConfig = await readJson(dbConfigFilePath);
    expect(dbConfig.databases.variantAnalysis.repositoryLists).toHaveLength(1);
    expect(dbConfig.databases.variantAnalysis.repositoryLists[0].name).toBe(
      "my-list-1",
    );
  });

  it.skip("should add new local db list", async () => {
    // Add db list
    jest.spyOn(window, "showQuickPick").mockResolvedValue({
      databaseKind: DbListKind.Local,
    } as AddListQuickPickItem);
    jest.spyOn(window, "showInputBox").mockResolvedValue("my-list-1");
    await commandManager.execute(
      "codeQLVariantAnalysisRepositories.addNewList",
    );

    // Check db config
    const dbConfigFilePath = path.join(
      storagePath,
      DbConfigStore.databaseConfigFileName,
    );
    const dbConfig: DbConfig = await readJson(dbConfigFilePath);
    expect(dbConfig.databases.local.lists).toHaveLength(1);
    expect(dbConfig.databases.local.lists[0].name).toBe("my-list-1");
  });

  it("should add new remote repository", async () => {
    // Add db
    jest.spyOn(window, "showQuickPick").mockResolvedValue({
      remoteDatabaseKind: "repo",
    } as RemoteDatabaseQuickPickItem);

    jest.spyOn(window, "showInputBox").mockResolvedValue("owner1/repo1");
    await commandManager.execute(
      "codeQLVariantAnalysisRepositories.addNewDatabase",
    );

    // Check db config
    const dbConfigFilePath = path.join(
      storagePath,
      DbConfigStore.databaseConfigFileName,
    );
    const dbConfig: DbConfig = await readJson(dbConfigFilePath);
    expect(dbConfig.databases.variantAnalysis.repositories).toHaveLength(1);
    expect(dbConfig.databases.variantAnalysis.repositories[0]).toBe(
      "owner1/repo1",
    );
  });

  it("should add new remote owner", async () => {
    // Add owner
    jest.spyOn(window, "showQuickPick").mockResolvedValue({
      remoteDatabaseKind: "owner",
    } as RemoteDatabaseQuickPickItem);

    jest.spyOn(window, "showInputBox").mockResolvedValue("owner1");
    await commandManager.execute(
      "codeQLVariantAnalysisRepositories.addNewDatabase",
    );

    // Check db config
    const dbConfigFilePath = path.join(
      storagePath,
      DbConfigStore.databaseConfigFileName,
    );
    const dbConfig: DbConfig = await readJson(dbConfigFilePath);
    expect(dbConfig.databases.variantAnalysis.owners).toHaveLength(1);
    expect(dbConfig.databases.variantAnalysis.owners[0]).toBe("owner1");
  });

  it("should import from code search", async () => {
    const mockServer = new MockGitHubApiServer();
    mockServer.startServer();

    await mockServer.loadScenario("code-search-success");

    jest.spyOn(window, "showInputBox").mockResolvedValue("listname");
    await commandManager.execute(
      "codeQLVariantAnalysisRepositories.addNewList",
    );

    const dbTreeViewItem = createDbTreeViewItemUserDefinedList(
      createRemoteUserDefinedListDbItem(),
      "listname",
      [],
    );

    jest.spyOn(window, "showQuickPick").mockResolvedValue({
      language: "java",
    } as CodeSearchQuickPickItem);

    jest
      .spyOn(window, "showInputBox")
      .mockResolvedValue("org:github something");

    await commandManager.execute(
      "codeQLVariantAnalysisRepositories.importFromCodeSearch",
      dbTreeViewItem,
    );

    expect(window.showQuickPick).toBeCalledTimes(1);
    expect(window.showInputBox).toBeCalledTimes(2);

    const dbConfigFilePath = path.join(
      storagePath,
      DbConfigStore.databaseConfigFileName,
    );
    const dbConfig: DbConfig = await readJson(dbConfigFilePath);
    expect(dbConfig.databases.variantAnalysis.repositoryLists).toHaveLength(1);
    expect(dbConfig.databases.variantAnalysis.repositoryLists[0].name).toBe(
      "listname",
    );
    expect(
      dbConfig.databases.variantAnalysis.repositoryLists[0].repositories,
    ).toBe([]);

    await mockServer.unloadScenario();
    mockServer.stopServer();
  });

  it("should select db item", async () => {
    const listName = "top n repos";
    const treeViewItem = createDbTreeViewItemSystemDefinedList(
      createRemoteSystemDefinedListDbItem({ listName }),
      "label",
      "tooltip",
    );

    await commandManager.execute(
      "codeQLVariantAnalysisRepositories.setSelectedItemContextMenu",
      treeViewItem,
    );

    // Check db config
    const dbConfigFilePath = path.join(
      storagePath,
      DbConfigStore.databaseConfigFileName,
    );
    const dbConfig: DbConfig = await readJson(dbConfigFilePath);
    expect(dbConfig.selected).toBeDefined();
    expect(dbConfig.selected).toEqual({
      kind: SelectedDbItemKind.VariantAnalysisSystemDefinedList,
      listName,
    });
  });
});
