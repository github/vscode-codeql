import type { DbItem } from "../../../src/databases/db-item";
import { DbItemKind, flattenDbItems } from "../../../src/databases/db-item";
import {
  createRemoteOwnerDbItem,
  createRemoteRepoDbItem,
  createRemoteSystemDefinedListDbItem,
  createRemoteUserDefinedListDbItem,
  createRootRemoteDbItem,
} from "../../factories/db-item-factories";

describe("DbItem", () => {
  describe("flattenDbItems", () => {
    it("should flatten a list of DbItems", () => {
      const dbItems = [
        createRootRemoteDbItem({
          children: [
            createRemoteSystemDefinedListDbItem({ listName: "top10" }),
            createRemoteSystemDefinedListDbItem({ listName: "top100" }),
            createRemoteUserDefinedListDbItem({
              listName: "remote-list1",
              repos: [
                createRemoteRepoDbItem({ repoFullName: "owner1/repo1" }),
                createRemoteRepoDbItem({ repoFullName: "owner1/repo2" }),
              ],
            }),
            createRemoteUserDefinedListDbItem({
              listName: "remote-list2",
              repos: [
                createRemoteRepoDbItem({ repoFullName: "owner2/repo1" }),
                createRemoteRepoDbItem({ repoFullName: "owner2/repo2" }),
              ],
            }),
            createRemoteOwnerDbItem({ ownerName: "owner1" }),
            createRemoteRepoDbItem({ repoFullName: "owner3/repo3" }),
          ],
        }),
      ];

      const flattenedItems = flattenDbItems(dbItems);

      expect(flattenedItems.length).toEqual(11);
      checkRootRemoteExists(flattenedItems);
      checkSystemDefinedListExists(flattenedItems, "top10");
      checkSystemDefinedListExists(flattenedItems, "top100");
      checkUserDefinedListExists(flattenedItems, "remote-list1");
      checkRemoteRepoExists(flattenedItems, "owner1/repo1");
      checkRemoteRepoExists(flattenedItems, "owner1/repo2");
      checkRemoteRepoExists(flattenedItems, "owner2/repo1");
      checkRemoteRepoExists(flattenedItems, "owner2/repo2");
      checkRemoteOwnerExists(flattenedItems, "owner1");
      checkRemoteRepoExists(flattenedItems, "owner3/repo3");
    });

    function checkRootRemoteExists(items: DbItem[]): void {
      expect(
        items.find((item) => item.kind === DbItemKind.RootRemote),
      ).toBeDefined();
    }

    function checkUserDefinedListExists(items: DbItem[], name: string): void {
      expect(
        items.find(
          (item) =>
            item.kind === DbItemKind.RemoteUserDefinedList &&
            item.listName === name,
        ),
      ).toBeDefined();
    }

    function checkSystemDefinedListExists(items: DbItem[], name: string): void {
      expect(
        items.find(
          (item) =>
            item.kind === DbItemKind.RemoteSystemDefinedList &&
            item.listName === name,
        ),
      ).toBeDefined();
    }

    function checkRemoteOwnerExists(items: DbItem[], name: string): void {
      expect(
        items.find(
          (item) =>
            item.kind === DbItemKind.RemoteOwner && item.ownerName === name,
        ),
      ).toBeDefined();
    }

    function checkRemoteRepoExists(items: DbItem[], name: string): void {
      expect(
        items.find(
          (item) =>
            item.kind === DbItemKind.RemoteRepo && item.repoFullName === name,
        ),
      ).toBeDefined();
    }
  });
});
