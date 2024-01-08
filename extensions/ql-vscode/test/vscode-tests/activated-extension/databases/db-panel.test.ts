import { window } from "vscode";

import { readJson } from "fs-extra";
import { join } from "path";
import type { DbConfig } from "../../../../src/databases/config/db-config";
import { SelectedDbItemKind } from "../../../../src/databases/config/db-config";
import type { RemoteDatabaseQuickPickItem } from "../../../../src/databases/ui/db-panel";
import { createDbTreeViewItemSystemDefinedList } from "../../../../src/databases/ui/db-tree-view-item";
import { createRemoteSystemDefinedListDbItem } from "../../../factories/db-item-factories";
import { DbConfigStore } from "../../../../src/databases/config/db-config-store";
import { getActivatedExtension } from "../../global.helper";
import { createVSCodeCommandManager } from "../../../../src/common/vscode/commands";
import type { AllCommands } from "../../../../src/common/commands";

jest.setTimeout(60_000);

describe("Db panel UI commands", () => {
  // This test has some serious problems:
  // - all tests use the same dbConfig file, hence the tests depend on ORDER and have to use the same list name!
  // - we depend on highlighted list items when adding a repo to a list. If there's not enough time in between, a test might think a list is highlighted that doesn't exist anymore

  let storagePath: string;
  let dbConfigFilePath: string;

  const commandManager = createVSCodeCommandManager<AllCommands>();

  beforeEach(async () => {
    const extension = await getActivatedExtension();

    storagePath =
      extension.ctx.storageUri?.fsPath || extension.ctx.globalStorageUri.fsPath;

    dbConfigFilePath = join(storagePath, DbConfigStore.databaseConfigFileName);
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
});
