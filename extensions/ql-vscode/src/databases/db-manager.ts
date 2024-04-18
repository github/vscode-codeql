import type { App } from "../common/app";
import type { AppEvent, AppEventEmitter } from "../common/events";
import { ValueResult } from "../common/value-result";
import { DisposableObject } from "../common/disposable-object";
import type { DbConfigStore } from "./config/db-config-store";
import type { DbItem, RemoteUserDefinedListDbItem } from "./db-item";
import type { ExpandedDbItem } from "./db-item-expansion";
import {
  updateExpandedItem,
  replaceExpandedItem,
  cleanNonExistentExpandedItems,
} from "./db-item-expansion";
import {
  getSelectedDbItem,
  mapDbItemToSelectedDbItem,
} from "./db-item-selection";
import { createRemoteTree } from "./db-tree-creator";
import type { DbConfigValidationError } from "./db-validation-errors";
import type { VariantAnalysisConfig } from "../config";

export class DbManager extends DisposableObject {
  public readonly onDbItemsChanged: AppEvent<void>;
  public static readonly DB_EXPANDED_STATE_KEY = "db_expanded";
  private readonly onDbItemsChangesEventEmitter: AppEventEmitter<void>;

  constructor(
    private readonly app: App,
    private readonly dbConfigStore: DbConfigStore,
    private readonly variantAnalysisConfigListener: VariantAnalysisConfig,
  ) {
    super();

    this.onDbItemsChangesEventEmitter = this.push(
      app.createEventEmitter<void>(),
    );
    this.onDbItemsChanged = this.onDbItemsChangesEventEmitter.event;

    this.dbConfigStore.onDidChangeConfig(() => {
      this.onDbItemsChangesEventEmitter.fire();
    });

    this.variantAnalysisConfigListener.onDidChangeConfiguration?.(() => {
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

    const remoteTree = createRemoteTree(
      configResult.value,
      this.variantAnalysisConfigListener,
      expandedItems,
    );
    return ValueResult.ok(remoteTree.children);
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

  public async removeDbItem(dbItem: DbItem): Promise<void> {
    await this.dbConfigStore.removeDbItem(dbItem);

    await this.removeDbItemFromExpandedState(dbItem);
  }

  public async removeDbItemFromExpandedState(dbItem: DbItem): Promise<void> {
    // When collapsing or expanding a list we clean up the expanded state and remove
    // all items that don't exist anymore.

    await this.updateDbItemExpandedState(dbItem, false);
  }

  public async addDbItemToExpandedState(dbItem: DbItem): Promise<void> {
    // When collapsing or expanding a list we clean up the expanded state and remove
    // all items that don't exist anymore.

    await this.updateDbItemExpandedState(dbItem, true);
  }

  public async addNewRemoteRepo(
    nwo: string,
    parentList?: string,
  ): Promise<void> {
    await this.dbConfigStore.addRemoteRepo(nwo, parentList);
  }

  public async addNewRemoteReposToList(
    nwoList: string[],
    parentList: string,
  ): Promise<void> {
    await this.dbConfigStore.addRemoteReposToList(nwoList, parentList);
  }

  public async addNewRemoteOwner(owner: string): Promise<void> {
    await this.dbConfigStore.addRemoteOwner(owner);
  }

  public async addNewList(listName: string): Promise<void> {
    await this.dbConfigStore.addRemoteList(listName);
  }

  public async renameList(
    currentDbItem: RemoteUserDefinedListDbItem,
    newName: string,
  ): Promise<void> {
    await this.dbConfigStore.renameRemoteList(currentDbItem, newName);

    const newDbItem = { ...currentDbItem, listName: newName };
    const newExpandedItems = replaceExpandedItem(
      this.getExpandedItems(),
      currentDbItem,
      newDbItem,
    );

    await this.setExpandedItems(newExpandedItems);
  }

  public doesListExist(listName: string): boolean {
    return this.dbConfigStore.doesRemoteListExist(listName);
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

  private async updateExpandedItems(items: ExpandedDbItem[]): Promise<void> {
    let itemsToStore;

    const dbItemsResult = this.getDbItems();

    if (dbItemsResult.isFailure) {
      // Log an error but don't throw an exception since if the db items are failing
      // to be read, then there is a bigger problem than the expanded state.
      void this.app.logger.log(
        `Could not read db items when calculating expanded state: ${JSON.stringify(
          dbItemsResult.errors,
        )}`,
      );
      itemsToStore = items;
    } else {
      itemsToStore = cleanNonExistentExpandedItems(items, dbItemsResult.value);
    }

    await this.setExpandedItems(itemsToStore);
  }

  private async updateDbItemExpandedState(
    dbItem: DbItem,
    itemExpanded: boolean,
  ): Promise<void> {
    const currentExpandedItems = this.getExpandedItems();

    const newExpandedItems = updateExpandedItem(
      currentExpandedItems,
      dbItem,
      itemExpanded,
    );

    await this.updateExpandedItems(newExpandedItems);
  }
}
