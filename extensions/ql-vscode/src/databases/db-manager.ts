import { App } from "../common/app";
import { AppEvent, AppEventEmitter } from "../common/events";
import { ValueResult } from "../common/value-result";
import { DbConfigStore } from "./config/db-config-store";
import { DbItem, DbListKind } from "./db-item";
import { updateItemInExpandedState, ExpandedDbItem } from "./db-item-expansion";
import {
  getSelectedDbItem,
  mapDbItemToSelectedDbItem,
} from "./db-item-selection";
import { createLocalTree, createRemoteTree } from "./db-tree-creator";
import { DbConfigValidationError } from "./db-validation-errors";

export class DbManager {
  public readonly onDbItemsChanged: AppEvent<void>;
  private readonly onDbItemsChangesEventEmitter: AppEventEmitter<void>;
  private static readonly DB_EXPANDED_STATE_KEY = "db_expanded";

  constructor(
    private readonly app: App,
    private readonly dbConfigStore: DbConfigStore,
  ) {
    this.onDbItemsChangesEventEmitter = app.createEventEmitter<void>();
    this.onDbItemsChanged = this.onDbItemsChangesEventEmitter.event;

    this.dbConfigStore.onDidChangeConfig(() => {
      this.onDbItemsChangesEventEmitter.fire();
    });
  }

  public getSelectedDbItem(): DbItem | undefined {
    const dbItemsResult = this.getDbItems();

    if (dbItemsResult.errors.length > 0) {
      return undefined;
    }

    return getSelectedDbItem(dbItemsResult.value);
  }

  public getDbItems(): ValueResult<DbItem[], DbConfigValidationError> {
    const configResult = this.dbConfigStore.getConfig();
    if (configResult.isFailure) {
      return ValueResult.fail(configResult.errors);
    }

    const expandedItems = this.getExpandedItems();

    return ValueResult.ok([
      createRemoteTree(configResult.value, expandedItems),
      createLocalTree(configResult.value, expandedItems),
    ]);
  }

  public getConfigPath(): string {
    return this.dbConfigStore.getConfigPath();
  }

  public async setSelectedDbItem(dbItem: DbItem): Promise<void> {
    const selectedDbItem = mapDbItemToSelectedDbItem(dbItem);
    if (selectedDbItem) {
      await this.dbConfigStore.setSelectedDbItem(selectedDbItem);
    }
  }

  public async updateDbItemExpandedState(
    dbItem: DbItem,
    itemExpanded: boolean,
  ): Promise<void> {
    const configResult = this.dbConfigStore.getConfig();
    if (configResult.isFailure) {
      throw Error("Cannot update expanded state if config is not loaded");
    }

    const currentExpandedItems = this.getExpandedItems();

    const newExpandedItems = updateItemInExpandedState(
      currentExpandedItems,
      dbItem,
      itemExpanded,
    );

    await this.setExpandedItems(newExpandedItems);
  }

  public async addNewRemoteRepo(
    nwo: string,
    parentList?: string,
  ): Promise<void> {
    await this.dbConfigStore.addRemoteRepo(nwo, parentList);
  }

  public async addNewRemoteOwner(owner: string): Promise<void> {
    await this.dbConfigStore.addRemoteOwner(owner);
  }

  public async addNewList(
    listKind: DbListKind,
    listName: string,
  ): Promise<void> {
    switch (listKind) {
      case DbListKind.Local:
        await this.dbConfigStore.addLocalList(listName);
        break;
      case DbListKind.Remote:
        await this.dbConfigStore.addRemoteList(listName);
        break;
      default:
        throw Error(`Unknown list kind '${listKind}'`);
    }
  }

  public doesListExist(listKind: DbListKind, listName: string): boolean {
    switch (listKind) {
      case DbListKind.Local:
        return this.dbConfigStore.doesLocalListExist(listName);
      case DbListKind.Remote:
        return this.dbConfigStore.doesRemoteListExist(listName);
      default:
        throw Error(`Unknown list kind '${listKind}'`);
    }
  }

  public doesRemoteOwnerExist(owner: string): boolean {
    return this.dbConfigStore.doesRemoteOwnerExist(owner);
  }

  public doesRemoteRepoExist(nwo: string, listName?: string): boolean {
    return this.dbConfigStore.doesRemoteDbExist(nwo, listName);
  }

  private getExpandedItems(): ExpandedDbItem[] {
    const items = this.app.workspaceState.get<ExpandedDbItem[]>(
      DbManager.DB_EXPANDED_STATE_KEY,
    );

    return items || [];
  }

  private async setExpandedItems(items: ExpandedDbItem[]): Promise<void> {
    await this.app.workspaceState.update(
      DbManager.DB_EXPANDED_STATE_KEY,
      items,
    );
  }
}
