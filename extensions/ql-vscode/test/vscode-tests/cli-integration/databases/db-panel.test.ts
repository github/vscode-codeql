import { commands, extensions, window } from "vscode";

import { CodeQLExtensionInterface } from "../../../../src/extension";
import { readJson } from "fs-extra";
import * as path from "path";
import {
  DbConfig,
  SelectedDbItemKind,
} from "../../../../src/databases/config/db-config";
import {
  AddListQuickPickItem,
  RemoteDatabaseQuickPickItem,
} from "../../../../src/databases/ui/db-panel";
import { DbListKind } from "../../../../src/databases/db-item";
import { createDbTreeViewItemSystemDefinedList } from "../../../../src/databases/ui/db-tree-view-item";
import { createRemoteSystemDefinedListDbItem } from "../../../factories/db-item-factories";

jest.setTimeout(60_000);

describe("Db panel UI commands", () => {
  let extension: CodeQLExtensionInterface | Record<string, never>;
  let storagePath: string;

  beforeEach(async () => {
    extension = await extensions
      .getExtension<CodeQLExtensionInterface | Record<string, never>>(
        "GitHub.vscode-codeql",
      )!
      .activate();

    storagePath =
      extension.ctx.storageUri?.fsPath || extension.ctx.globalStorageUri.fsPath;
  });

  it("should add new remote db list", async () => {
    // Add db list
    jest.spyOn(window, "showQuickPick").mockResolvedValue({
      kind: DbListKind.Remote,
    } as AddListQuickPickItem);
    jest.spyOn(window, "showInputBox").mockResolvedValue("my-list-1");
    await commands.executeCommand("codeQLDatabasesExperimental.addNewList");

    // Check db config
    const dbConfigFilePath = path.join(storagePath, "workspace-databases.json");
    const dbConfig: DbConfig = await readJson(dbConfigFilePath);
    expect(dbConfig.databases.remote.repositoryLists).toHaveLength(1);
    expect(dbConfig.databases.remote.repositoryLists[0].name).toBe("my-list-1");
  });

  it("should add new local db list", async () => {
    // Add db list
    jest.spyOn(window, "showQuickPick").mockResolvedValue({
      kind: DbListKind.Local,
    } as AddListQuickPickItem);
    jest.spyOn(window, "showInputBox").mockResolvedValue("my-list-1");
    await commands.executeCommand("codeQLDatabasesExperimental.addNewList");

    // Check db config
    const dbConfigFilePath = path.join(storagePath, "workspace-databases.json");
    const dbConfig: DbConfig = await readJson(dbConfigFilePath);
    expect(dbConfig.databases.local.lists).toHaveLength(1);
    expect(dbConfig.databases.local.lists[0].name).toBe("my-list-1");
  });

  it("should add new remote repository", async () => {
    // Add db
    jest.spyOn(window, "showQuickPick").mockResolvedValue({
      kind: "repo",
    } as RemoteDatabaseQuickPickItem);

    jest.spyOn(window, "showInputBox").mockResolvedValue("owner1/repo1");
    await commands.executeCommand("codeQLDatabasesExperimental.addNewDatabase");

    // Check db config
    const dbConfigFilePath = path.join(storagePath, "workspace-databases.json");
    const dbConfig: DbConfig = await readJson(dbConfigFilePath);
    expect(dbConfig.databases.remote.repositories).toHaveLength(1);
    expect(dbConfig.databases.remote.repositories[0]).toBe("owner1/repo1");
  });

  it("should add new remote owner", async () => {
    // Add owner
    jest.spyOn(window, "showQuickPick").mockResolvedValue({
      kind: "owner",
    } as RemoteDatabaseQuickPickItem);

    jest.spyOn(window, "showInputBox").mockResolvedValue("owner1");
    await commands.executeCommand("codeQLDatabasesExperimental.addNewDatabase");

    // Check db config
    const dbConfigFilePath = path.join(storagePath, "workspace-databases.json");
    const dbConfig: DbConfig = await readJson(dbConfigFilePath);
    expect(dbConfig.databases.remote.owners).toHaveLength(1);
    expect(dbConfig.databases.remote.owners[0]).toBe("owner1");
  });

  it("should select db item", async () => {
    const listName = "top n repos";
    const treeViewItem = createDbTreeViewItemSystemDefinedList(
      createRemoteSystemDefinedListDbItem({ listName }),
      "label",
      "tooltip",
    );

    await commands.executeCommand(
      "codeQLDatabasesExperimental.setSelectedItemContextMenu",
      treeViewItem,
    );

    // Check db config
    const dbConfigFilePath = path.join(storagePath, "workspace-databases.json");
    const dbConfig: DbConfig = await readJson(dbConfigFilePath);
    expect(dbConfig.selected).toBeDefined();
    expect(dbConfig.selected).toEqual({
      kind: SelectedDbItemKind.RemoteSystemDefinedList,
      listName,
    });
  });
});
