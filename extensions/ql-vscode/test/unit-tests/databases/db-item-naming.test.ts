import { getDbItemName } from "../../../src/databases/db-item-naming";
import {
  createRemoteOwnerDbItem,
  createRemoteRepoDbItem,
  createRemoteSystemDefinedListDbItem,
  createRemoteUserDefinedListDbItem,
  createRootRemoteDbItem,
} from "../../factories/db-item-factories";

describe("db item naming", () => {
  describe("getDbItemName", () => {
    it("return undefined for root remote db item", () => {
      const dbItem = createRootRemoteDbItem();

      const name = getDbItemName(dbItem);

      expect(name).toBeUndefined();
    });

    it("return list name for remote user defined list db item", () => {
      const dbItem = createRemoteUserDefinedListDbItem();

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

    it("return repo name for remote repo db item", () => {
      const dbItem = createRemoteRepoDbItem();

      const name = getDbItemName(dbItem);

      expect(name).toEqual(dbItem.repoFullName);
    });
  });
});
