import { App } from "../common/app";
import { AppEvent, AppEventEmitter } from "../common/events";
import { ValueResult } from "../common/value-result";
import { DbConfigStore } from "./config/db-config-store";
import { DbItem, DbItemKind, remoteDbKinds } from "./db-item";
import { calculateNewExpandedState } from "./db-item-expansion";
import {
  getSelectedDbItem,
  mapDbItemToSelectedDbItem,
} from "./db-item-selection";
import { createLocalTree, createRemoteTree } from "./db-tree-creator";
import { DbConfigValidationError } from "./db-validation-errors";

export class DbManager {
  public readonly onDbItemsChanged: AppEvent<void>;
  private readonly onDbItemsChangesEventEmitter: AppEventEmitter<void>;

  constructor(app: App, private readonly dbConfigStore: DbConfigStore) {
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

    return ValueResult.ok([
      createRemoteTree(configResult.value),
      createLocalTree(configResult.value),
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

    const newExpandedItems = calculateNewExpandedState(
      configResult.value.expanded,
      dbItem,
      itemExpanded,
    );

    await this.dbConfigStore.updateExpandedState(newExpandedItems);
  }

  public async addNewRemoteRepo(nwo: string): Promise<void> {
    if (nwo === "") {
      throw new Error("Repository name cannot be empty");
    }
    if (this.dbConfigStore.doesRemoteDbExist(nwo)) {
      throw new Error(`The repository '${nwo}' already exists`);
    }

    await this.dbConfigStore.addRemoteRepo(nwo);
  }

  public async addNewRemoteOwner(owner: string): Promise<void> {
    if (owner === "") {
      throw Error("Owner name cannot be empty");
    }
    if (this.dbConfigStore.doesRemoteOwnerExist(owner)) {
      throw Error(`The owner '${owner}' already exists`);
    }

    await this.dbConfigStore.addRemoteOwner(owner);
  }

  public async addNewList(kind: DbItemKind, listName: string): Promise<void> {
    if (remoteDbKinds.includes(kind)) {
      if (listName === "") {
        throw Error("List name cannot be empty");
      }
      if (this.dbConfigStore.doesRemoteListExist(listName)) {
        throw Error(`A list with the name '${listName}' already exists`);
      }

      await this.dbConfigStore.addRemoteList(listName);
    } else {
      throw Error("Cannot add a local list");
    }
  }
}
