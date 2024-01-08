import type { ExpandedDbItem } from "../../../src/databases/db-item-expansion";
import {
  updateExpandedItem,
  ExpandedDbItemKind,
  replaceExpandedItem,
  cleanNonExistentExpandedItems,
} from "../../../src/databases/db-item-expansion";
import {
  createRemoteUserDefinedListDbItem,
  createRootRemoteDbItem,
} from "../../factories/db-item-factories";

describe("db item expansion", () => {
  describe("updateExpandedItem", () => {
    it("should add an expanded item to an existing list", () => {
      const currentExpandedItems: ExpandedDbItem[] = [
        {
          kind: ExpandedDbItemKind.RootRemote,
        },
        {
          kind: ExpandedDbItemKind.RemoteUserDefinedList,
          listName: "list1",
        },
      ];

      const dbItem = createRemoteUserDefinedListDbItem({
        listName: "list2",
      });

      const newExpandedItems = updateExpandedItem(
        currentExpandedItems,
        dbItem,
        true,
      );

      expect(newExpandedItems).toEqual([
        ...currentExpandedItems,
        {
          kind: ExpandedDbItemKind.RemoteUserDefinedList,
          listName: "list2",
        },
      ]);
    });

    it("should add an expanded item to an empty list", () => {
      const dbItem = createRemoteUserDefinedListDbItem({
        listName: "list2",
      });

      const newExpandedItems = updateExpandedItem([], dbItem, true);

      expect(newExpandedItems).toEqual([
        {
          kind: ExpandedDbItemKind.RemoteUserDefinedList,
          listName: "list2",
        },
      ]);
    });

    it("should remove a collapsed item from a list", () => {
      const currentExpandedItems: ExpandedDbItem[] = [
        {
          kind: ExpandedDbItemKind.RootRemote,
        },
        {
          kind: ExpandedDbItemKind.RemoteUserDefinedList,
          listName: "list1",
        },
      ];

      const dbItem = createRemoteUserDefinedListDbItem({
        listName: "list1",
      });

      const newExpandedItems = updateExpandedItem(
        currentExpandedItems,
        dbItem,
        false,
      );

      expect(newExpandedItems).toEqual([
        {
          kind: ExpandedDbItemKind.RootRemote,
        },
      ]);
    });

    it("should remove a collapsed item from a list that becomes empty", () => {
      const currentExpandedItems: ExpandedDbItem[] = [
        {
          kind: ExpandedDbItemKind.RootRemote,
        },
      ];

      const dbItem = createRootRemoteDbItem();

      const newExpandedItems = updateExpandedItem(
        currentExpandedItems,
        dbItem,
        false,
      );

      expect(newExpandedItems).toEqual([]);
    });
  });

  describe("replaceExpandedItem", () => {
    it("should replace the db item", () => {
      const currentExpandedItems: ExpandedDbItem[] = [
        {
          kind: ExpandedDbItemKind.RootRemote,
        },
        {
          kind: ExpandedDbItemKind.RemoteUserDefinedList,
          listName: "list1",
        },
        {
          kind: ExpandedDbItemKind.RemoteUserDefinedList,
          listName: "list2",
        },
      ];

      const currentDbItem = createRemoteUserDefinedListDbItem({
        listName: "list1",
      });

      const newDbItem = {
        ...currentDbItem,
        listName: "list1 (renamed)",
      };

      const newExpandedItems = replaceExpandedItem(
        currentExpandedItems,
        currentDbItem,
        newDbItem,
      );

      expect(newExpandedItems).toEqual([
        {
          kind: ExpandedDbItemKind.RootRemote,
        },
        {
          kind: ExpandedDbItemKind.RemoteUserDefinedList,
          listName: "list1 (renamed)",
        },
        {
          kind: ExpandedDbItemKind.RemoteUserDefinedList,
          listName: "list2",
        },
      ]);
    });
  });

  describe("cleanNonExistentExpandedItems", () => {
    it("should remove non-existent items", () => {
      const currentExpandedItems: ExpandedDbItem[] = [
        {
          kind: ExpandedDbItemKind.RootRemote,
        },
        {
          kind: ExpandedDbItemKind.RemoteUserDefinedList,
          listName: "list1",
        },
        {
          kind: ExpandedDbItemKind.RemoteUserDefinedList,
          listName: "list2",
        },
      ];

      const dbItems = [
        createRootRemoteDbItem({
          children: [
            createRemoteUserDefinedListDbItem({
              listName: "list2",
            }),
          ],
        }),
      ];

      const newExpandedItems = cleanNonExistentExpandedItems(
        currentExpandedItems,
        dbItems,
      );

      expect(newExpandedItems).toEqual([
        {
          kind: ExpandedDbItemKind.RootRemote,
        },
        {
          kind: ExpandedDbItemKind.RemoteUserDefinedList,
          listName: "list2",
        },
      ]);
    });
  });
});
