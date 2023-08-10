import { authentication, window } from "vscode";

import { readJson, writeJson } from "fs-extra";
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
import { sleep } from "../../../../src/common/time";
import { createDbConfig } from "../../../factories/db-config-factories";

jest.setTimeout(60_000);

describe("Db panel UI commands", () => {
  // This test has some serious problems:
  // a) it runs twice: we couldn't find out why
  // b) all tests use the same dbConfig file, hence the tests depend on ORDER and have to use the same list name!
  // c) since we use a file watcher to update the config we sometimes need to wait (sleep) before accessing the config again
  // d) we depend on highlighted list items when adding a repo to a list. If there's not enough time in between, a test might think a list is highlighted that doesn't exist anymore
  let storagePath: string;
  let dbConfigFilePath: string;
  const commandManager = createVSCodeCommandManager<AllCommands>();

  beforeEach(async () => {
    const extension = await getActivatedExtension();

    storagePath =
      extension.ctx.storageUri?.fsPath || extension.ctx.globalStorageUri.fsPath;

    dbConfigFilePath = path.join(
      storagePath,
      DbConfigStore.databaseConfigFileName,
    );
  });

  it("should add new remote db list", async () => {
    // Add db list
    jest.spyOn(window, "showInputBox").mockResolvedValue("my-list-1");
    await commandManager.execute(
      "codeQLVariantAnalysisRepositories.addNewList",
    );

    // Check db config
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
    const dbConfig: DbConfig = await readJson(dbConfigFilePath);
    expect(dbConfig.databases.variantAnalysis.owners).toHaveLength(1);
    expect(dbConfig.databases.variantAnalysis.owners[0]).toBe("owner1");
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
    const dbConfig: DbConfig = await readJson(dbConfigFilePath);
    expect(dbConfig.selected).toBeDefined();
    expect(dbConfig.selected).toEqual({
      kind: SelectedDbItemKind.VariantAnalysisSystemDefinedList,
      listName,
    });
  });

  it("should import from code search", async () => {
    // This name is important, since other tests depend on only one list being present during the second suite run.
    // See comment above.
    // ;(
    const listName = "my-list-1";
    const mockServer = new MockGitHubApiServer();
    mockServer.startServer();

    await mockServer.loadScenario("code-search-success");

    jest.spyOn(authentication, "getSession").mockResolvedValue({
      id: "test",
      accessToken: "test-token",
      scopes: [],
      account: {
        id: "test",
        label: "test",
      },
    });

    const dbConfigPreparation: DbConfig = createDbConfig({
      remoteLists: [
        {
          name: listName,
          repositories: [],
        },
      ],
    });

    await writeJson(dbConfigFilePath, dbConfigPreparation);
    await sleep(5000);

    const dbTreeViewItem = createDbTreeViewItemUserDefinedList(
      createRemoteUserDefinedListDbItem({ listName }),
      listName,
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

    await sleep(200);

    expect(window.showQuickPick).toBeCalledTimes(1);
    expect(window.showInputBox).toBeCalledTimes(1);

    const dbConfig: DbConfig = await readJson(dbConfigFilePath);
    expect(dbConfig.databases.variantAnalysis.repositoryLists).toHaveLength(1);
    expect(dbConfig.databases.variantAnalysis.repositoryLists[0].name).toBe(
      listName,
    );
    expect(
      dbConfig.databases.variantAnalysis.repositoryLists[0].repositories,
    ).toEqual([
      "dotnet/aspnetcore",
      "dotnet/efcore",
      "dotnet/machinelearning",
      "dotnet/roslyn",
      "dotnet/maui",
      "dotnet/msbuild",
      "dotnet/Microsoft.Maui.Graphics",
      "dotnet/dotnet",
      "dotnet/BenchmarkDotNet",
      "dotnet/runtime",
      "dotnet/core",
      "dotnet/Microsoft.Maui.Graphics.Controls",
    ]);

    await mockServer.unloadScenario();
    mockServer.stopServer();
  });
});
