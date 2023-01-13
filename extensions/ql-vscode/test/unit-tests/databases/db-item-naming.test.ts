import { getDbItemName } from "../../../src/databases/db-item-naming";
import {
  createLocalDatabaseDbItem,
  createLocalListDbItem,
  createRemoteOwnerDbItem,
  createRemoteRepoDbItem,
  createRemoteSystemDefinedListDbItem,
  createVariantAnalysisUserDefinedListDbItem,
  createRootLocalDbItem,
  createRootRemoteDbItem,
} from "../../factories/db-item-factories";

describe("db item naming", () => {
  describe("getDbItemName", () => {
    it("return undefined for root local db item", () => {
      const dbItem = createRootLocalDbItem();

      const name = getDbItemName(dbItem);

      expect(name).toBeUndefined();
    });

    it("return undefined for root remote db item", () => {
      const dbItem = createRootRemoteDbItem();

      const name = getDbItemName(dbItem);

      expect(name).toBeUndefined();
    });

    it("return list name for local list db item", () => {
      const dbItem = createLocalListDbItem();

      const name = getDbItemName(dbItem);

      expect(name).toEqual(dbItem.listName);
    });

    it("return list name for remote user defined list db item", () => {
      const dbItem = createVariantAnalysisUserDefinedListDbItem();

      const name = getDbItemName(dbItem);

      expect(name).toEqual(dbItem.listName);
    });

    it("return list name for remote system defined list db item", () => {
      const dbItem = createRemoteSystemDefinedListDbItem();

      const name = getDbItemName(dbItem);

      expect(name).toEqual(dbItem.listName);
    });

    it("return owner name for owner db item", () => {
      const dbItem = createRemoteOwnerDbItem();

      const name = getDbItemName(dbItem);

      expect(name).toEqual(dbItem.ownerName);
    });

    it("return database name for local db item", () => {
      const dbItem = createLocalDatabaseDbItem();

      const name = getDbItemName(dbItem);

      expect(name).toEqual(dbItem.databaseName);
    });

    it("return repo name for remote repo db item", () => {
      const dbItem = createRemoteRepoDbItem();

      const name = getDbItemName(dbItem);

      expect(name).toEqual(dbItem.repoFullName);
    });
  });
});
